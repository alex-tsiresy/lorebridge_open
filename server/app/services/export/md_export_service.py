from collections.abc import Generator

from sqlalchemy.orm import Session

from app.core.logger import logger
from app.services.ai.llm_input_preparation_service import LLMInputPreparationService
from app.services.processing.stream_processing_service import StreamProcessingService
from app.services.session.session_validation_service import SessionValidationService
from app.services.metrics import EXPORT_ERRORS, EXPORT_PROCESS_SECONDS

# Import the system prompt (we'll move this to a constants file later if needed)
SYSTEM_PROMPT = """
You are an expert content formatter using React Markdown (`react-markdown` ^10.1.0), GFM (`remark-gfm` ^4.0.0), and syntax highlighting (`rehype-highlight` ^6.0.0). Produce clean, production‑ready **Markdown** with semantic hooks for custom styling.

**FORMATTING RULES:**

1. **HEADINGS & SECTIONS**
- Always wrap headings in `**...**` so they render bold: e.g. `# **Main Title**`
- Use `# ` for H1 (Title), `## ` for H2 (major sections), `### ` for H3 (subsections)
- Maintain logical hierarchical structure
- Use clear, descriptive headings that reflect the content

2. **PARAGRAPHS**
- Write in clear, professional style with focused topic sentences
- Keep paragraphs focused on single ideas (2-5 sentences)
- Use transitional phrases between paragraphs
- Separate distinct ideas with blank lines

3. **LISTS**
- Use numbered lists for sequential procedures: `1. `, `2. `, …
- Use bullet points for non-sequential items: `- ` or `* `
- Support up to 2 levels of nesting (indent sub‑items by two spaces)
- Keep lists compact without blank lines between items
- Use consistent formatting in list items

4. **TABLES**
- Use GFM tables, but **add a custom class** so you can style "cell borders" in CSS:
  ```html
  <table class="md-table md-table--cells">
    <thead>
      <tr>
        <th>Header A</th>
        <th>Header B</th>
        <th>Notes</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Cell A1</td>
        <td>Cell B1</td>
        <td>Explanation 1</td>
      </tr>
      <tr>
        <td>Cell A2</td>
        <td>Cell B2</td>
        <td>Explanation 2</td>
      </tr>
    </tbody>
  </table>
  ```
- Table headers must be plain text (never bold, never wrapped in `**...**`)
- Use bullet points for lists inside table cells whenever helpful. For example:
  | Lab      | Focus Areas         |
  |----------|---------------------|
  | DeepMind | - AlphaGo
    - AlphaFold |
- That `<table>` block will still be parsed by remark-gfm but gives you full control over cell borders and padding via CSS (e.g. `.md-table--cells td { border: 1px solid #ccc; padding: 8px; }`)

5. **CODE BLOCKS**
- Triple backticks with language tag for code:
  ```python
  import numpy as np
  ```
- Inline code: `` `function_name()` ``
- Include code comments and explanations when relevant

6. **EMPHASIS & CITATIONS**
- `**bold**` for key terms and concepts
- `*italic*` for emphasis and foreign terms
- Use in-text citations: `(Author, Year)` or `[1]` when appropriate
- Reference figures and tables: `Figure 1` or `Table 1`

7. **FIGURES & DIAGRAMS**
- Use placeholders: `![Figure 1: Description](image_url)`
- Include figure captions: `**Figure 1.** Description of the figure`
- Reference figures in text: `As shown in Figure 1...`

8. **MATHEMATICAL NOTATION**
- Use inline math: `$E = mc^2$`
- Use block math: `$$
E = mc^2
$$`
- Format equations clearly with proper notation

9. **REFERENCES & CITATIONS**
- Use numbered references: `[1]`, `[2]`, etc. when needed
- Format references in appropriate style for the content type
- Include DOI links when available
- Use consistent citation format throughout

10. **DOCUMENT STRUCTURE**
- Start with a clear title and introduction
- Present information in logical, systematic order
- Use transitional phrases between sections
- End with appropriate conclusion or summary
- Include relevant limitations and implications where appropriate

11. **CONTENT ADAPTATION**
- Adapt the tone and style to match the content type
- Use appropriate language level (technical, general, academic, etc.)
- Maintain consistency within the document
- Focus on clarity and readability

12. **SPECIAL FORMATTING**
- Use blockquotes for tips/warnings: `> **Tip:** Always validate inputs.`
- Use horizontal rules (`---`) to separate major sections
- Include callouts and highlights where appropriate
- Use emojis sparingly and purposefully for section clarity

---

**General Principles:**
- Maintain consistent formatting and style throughout
- Use clear, precise language appropriate for the content
- Ensure logical flow and coherence between sections
- Include appropriate citations and references when needed
- Focus on readability and user experience
- Apply formatting rules consistently regardless of content type
"""

class MarkdownExportService:
    """
    Markdown export service with separated concerns.

    This service orchestrates the markdown generation process by delegating
    to specialized services for each responsibility.
    """

    def __init__(
        self,
        db: Session,
        session_validator: SessionValidationService,
        input_preparer: LLMInputPreparationService,
        stream_processor: StreamProcessingService,
    ):
        self.db = db
        self.session_validator = session_validator
        self.input_preparer = input_preparer
        self.stream_processor = stream_processor

    def _clean_duplicate_content(self, content: str) -> str:
        """
        Clean up duplicate content that may have been stored in the database.
        This handles cases where the same markdown content was duplicated multiple times.
        """
        if not content:
            return content

        # Split content into lines to detect patterns
        lines = content.split("\n")
        if len(lines) < 10:  # Too short to have meaningful duplicates
            return content

        # Look for repeated patterns - if the same content appears multiple times
        # Find the first occurrence of a complete markdown document
        # (starts with # and ends with References or similar)

        # Simple heuristic: look for the first complete document
        start_markers = ["# **", "## **Abstract**", "## **Introduction**"]
        end_markers = ["## **References**", "## **Conclusion**"]

        start_idx = -1
        end_idx = -1

        # Find the start of the first document
        for i, line in enumerate(lines):
            if any(marker in line for marker in start_markers):
                start_idx = i
                break

        # Find the end of the first document
        if start_idx != -1:
            for i in range(start_idx + 1, len(lines)):
                if any(marker in lines[i] for marker in end_markers):
                    # Look for the end of this section
                    for j in range(i + 1, len(lines)):
                        if lines[j].strip() == "" or lines[j].startswith("#"):
                            end_idx = j
                            break
                    if end_idx == -1:
                        end_idx = len(lines)
                    break

        # If we found a complete document, return just that part
        if start_idx != -1 and end_idx != -1:
            cleaned_content = "\n".join(lines[start_idx:end_idx])
            logger.info(
                f"[MarkdownExport] Cleaned duplicate content: {len(content)} -> {len(cleaned_content)} characters"
            )
            return cleaned_content

        # If we couldn't detect a clear pattern, return the original content
        return content

    def stream_session_markdown_llm(
        self, session_id: str, model: str | None = None, selected_option: dict | None = None
    ) -> Generator[str, None, None]:
        """
        Streams a markdown document for the given chat session using an LLM.

        This is the orchestrator function that coordinates the entire process
        by delegating to specialized services.

        Args:
            session_id: Chat session ID
            model: Optional model name (defaults to "gpt-4.1")

        Yields:
            Markdown content chunks for streaming
        """
        logger.info(
            f"[MarkdownExport] Starting markdown generation for session: {session_id}"
        )

        # Step 1: Validate session and get messages
        messages, error = self._get_validated_messages(session_id)
        if error:
            yield f"# **{error}**\n"
            return

        # Step 2: Prepare LLM input
        llm_input = self._prepare_llm_input(messages, selected_option)

        # Step 3: Stream LLM response
        import time
        start_time = time.time()
        model_to_use = model or "gpt-4.1"
        try:
            yield from self.stream_processor.stream_llm_response(
                llm_input, model_to_use, session_id
            )
            EXPORT_PROCESS_SECONDS.labels("markdown", "success").observe(
                time.time() - start_time
            )
        except Exception as e:
            EXPORT_ERRORS.labels("markdown", e.__class__.__name__).inc()
            EXPORT_PROCESS_SECONDS.labels("markdown", "error").observe(
                time.time() - start_time
            )
            raise

    def _get_validated_messages(self, session_id: str) -> tuple[list, str | None]:
        """Get validated session messages or return error."""
        # Validate session exists
        session, error = self.session_validator.validate_and_get_session(session_id)
        if error:
            return [], error

        # Get session messages
        messages, error = self.session_validator.get_session_messages(session_id)
        if error:
            return [], error

        return messages, None

    def _prepare_llm_input(self, messages: list, selected_option: dict | None = None) -> list:
        """Prepare LLM input from messages, with optional user-selected guidance."""
        # Convert messages to chat history format
        chat_history = self.input_preparer.prepare_chat_history(messages)

        # Build complete LLM input
        llm_input = self.input_preparer.build_llm_input_messages(chat_history, system_prompt=SYSTEM_PROMPT)
        if selected_option:
            try:
                import json as _json
                guidance = _json.dumps(selected_option)
            except Exception:
                guidance = str(selected_option)
            # Append guidance as an extra user message
            llm_input.append({
                "role": "user",
                "content": [{"type": "input_text", "text": f"User-selected processing guidance for markdown (JSON):\n{guidance}"}],
            })
        return llm_input
