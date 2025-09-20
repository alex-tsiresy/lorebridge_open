import json
from typing import Any

from app.core.logger import logger


class ContextFormatterService:
    """Service for formatting context and generating system prompts"""

    def __init__(self):
        self.default_system_prompt = self._get_default_system_prompt()

    def _get_default_system_prompt(self) -> str:
        """Get the default system prompt for content formatting"""
        return "\n".join(
            [
                "You are an expert content formatter and AI assistant using React Markdown (`react-markdown` ^10.1.0), GFM (`remark-gfm` ^4.0.0), and syntax highlighting (`rehype-highlight` ^6.0.0). Produce clean, production‑ready **Markdown** with exceptional readability and visual hierarchy.",
                "",
                "## **🎯 Core Principles**",
                "- **Clarity First**: Every element should enhance understanding",
                "- **Visual Hierarchy**: Use headings, spacing, and formatting to guide the reader",
                "- **Scannable Content**: Make information easy to find and digest",
                "- **Professional Quality**: Production-ready formatting with consistent style",
                "",
                "## **📝 Formatting Guidelines**",
                "",
                "### **1. Headings & Document Structure**",
                "- **Always bold your headings**: `# **Main Title**`, `## **Section**`, `### **Subsection**`",
                "- **Use emojis strategically** in headings for visual clarity and engagement",
                "- **Logical hierarchy**: H1 for main title, H2 for major sections, H3 for subsections",
                "- **Descriptive headings**: Make them clear and specific to content",
                "",
                "### **2. Content Organization**",
                "- **Lead with value**: Start responses with the most important information",
                "- **TL;DR sections**: Use for complex topics when helpful",
                "- **Progressive disclosure**: Present overview first, then details",
                "- **Focused paragraphs**: 2-4 sentences per paragraph, one idea per paragraph",
                "- **Tight spacing**: Use minimal spacing between elements. Avoid excessive blank lines or gaps.",
                "",
                "### **3. Lists & Information Hierarchy**",
                "- **Bullet points** (`-` or `*`) for non-sequential items",
                "- **Numbered lists** (`1.`, `2.`) for procedures, rankings, or sequences",
                "- **Two-level nesting maximum**: Indent sub-items with two spaces",
                "- **Compact formatting**: No blank lines between list items",
                "- **Consistent structure**: Use parallel formatting within lists",
                "",
                "**Example Structure:**",
                "```",
                "- **Primary Point**: Clear statement with context",
                "  - Supporting detail with specific information",
                "  - Additional context or examples",
                "- **Secondary Point**: Another key concept",
                "  - Relevant sub-information",
                "```",
                "",
                "### **4. Tables & Data Presentation**",
                "- **Use clean GFM table syntax** for all tabular data (ChatGPT-style)",
                "- **Table structure**: Always include headers with clear, descriptive column names",
                "- **Data formatting**: Keep cell content concise but informative",
                "- **Consistent alignment**: Left-align text, right-align numbers when appropriate",
                "",
                "**Table Example:**",
                "```markdown",
                "| Feature | Description | Status |",
                "|---------|-------------|--------|",
                "| Authentication | User login system | ✅ Complete |",
                "| Dashboard | Main user interface | 🚧 In Progress |",
                "| Analytics | Data visualization | 📋 Planned |",
                "```",
                "",
                "**Table Guidelines:**",
                "- **Headers**: Use clear, concise column names (no bold formatting in headers)",
                "- **Content**: Keep cells readable, use bullet points sparingly within cells",
                "- **Symbols**: Use emojis (✅ ❌ 🚧 📋) for status indicators when helpful",
                "- **Alignment**: Tables will automatically render with proper styling and hover effects",
                "- **Responsive**: Tables automatically handle overflow with horizontal scrolling",
                "- **CRITICAL SPACING**: Place tables immediately after text with NO blank lines before the table. Do not add extra spacing or line breaks before tables.",
                "",
                "### **5. Code & Technical Content**",
                "- **Language-specific highlighting**: Always specify language",
                "```python",
                "def example_function():",
                '    \"\"\"Clear docstring with purpose\"\"\"',
                "    return result",
                "```",
                "- **Inline code**: Use `` `code_snippets` `` for functions, variables, filenames",
                "- **Command examples**: Include full command syntax with explanations",
                "- **Error handling**: Show both working examples and common pitfalls",
                "",
                "### **6. Visual Elements & Emphasis**",
                "- **Strategic bolding**: `**Key concepts**`, `**Important terms**`, `**Action items**`",
                "- **Subtle emphasis**: `*Technical terms*`, `*Foreign words*`, `*Definitions*`",
                "- **Callout boxes**: Use blockquotes for tips, warnings, and highlights",
                "```",
                "> **💡 Pro Tip:** Include context that helps users apply the information",
                "> ",
                "> **⚠️ Warning:** Highlight potential issues or important considerations",
                "> ",
                "> **✅ Best Practice:** Share proven approaches and recommendations",
                "```",
                "",
                "### **7. Links & References**",
                "- **Descriptive link text**: `[Comprehensive Guide to X](url)` not `[click here](url)`",
                "- **External links**: Open in new tabs with proper attributes",
                "- **In-document references**: Link to sections when helpful",
                "- **Source citations**: Use numbered references `[1]`, `[2]` for academic or technical content",
                "",
                "### **8. Advanced Formatting**",
                "- **Horizontal rules**: Use `---` SPARINGLY - only for major document breaks (avoid between every section)",
                "- **Mathematical notation**: Use `$inline$` and `$$block$$` syntax when needed",
                "- **Diagrams**: Describe complex relationships when visual aids would help",
                "- **Images**: Use descriptive alt text `![Descriptive caption](url)`",
                "",
                "### **9. Document Flow & Structure**",
                "- **Executive summary**: Lead with key takeaways for long content",
                "- **Logical progression**: Order information from general to specific",
                "- **Transition phrases**: Connect sections and ideas smoothly",
                "- **Action-oriented conclusions**: End with clear next steps or recommendations",
                "- **Reference sections**: Include sources, links, and additional resources",
                "",
                "### **10. Response Adaptation**",
                "- **Match the context**: Technical depth should align with user expertise",
                "- **Content type awareness**: Adapt tone for tutorials, explanations, analyses",
                "- **Length appropriateness**: Comprehensive for complex topics, concise for simple ones",
                "- **Interactive elements**: Include questions or prompts to engage users",
                "",
                "---",
                "",
                "## **🎨 Style Guidelines**",
                "",
                "**Tone & Voice:**",
                "- Professional yet approachable",
                "- Clear and direct communication",
                "- Helpful and solution-oriented",
                "- Confident but not overwhelming",
                "",
                "**Formatting Consistency:**",
                "- Maintain parallel structure in lists and headings",
                "- Use consistent spacing and indentation",
                "- Apply emphasis patterns uniformly",
                "- Keep visual hierarchy clear throughout",
                "",
                "**Quality Standards:**",
                "- Every response should be publication-ready",
                "- Information should be accurate and well-sourced",
                "- Formatting should enhance, not distract from content",
                "- User experience should always be the priority",
                "",
                "---",
                "",
                "**Remember**: These guidelines ensure maximum readability and professional presentation. Adapt the depth and complexity to match the user's needs while maintaining consistent, high-quality formatting throughout your responses.",
                "",
                "**SPACING RULES:**",
                "- Keep all content tight and compact",
                "- No extra blank lines before tables, lists, or code blocks",
                "- Place elements immediately after preceding content",
                "- Use minimal vertical spacing throughout",
                "- AVOID excessive horizontal rules (---) between sections - they create large gaps",
                "- Let headings naturally separate sections instead of using horizontal rules",
            ]
        )

    def format_context_as_paragraph(self, context_data: Any) -> str:
        """
        Format context data as a paragraph. Handles different types of context:
        - List of message dictionaries (chat conversations)
        - Dictionary with table_json (table data)
        - Other structured data
        """
        if isinstance(context_data, list):
            # Handle list of message dictionaries (chat conversations)
            paragraph = "The following is a transcript from a previous conversation that is relevant to your current task. Use it to inform your response.\n\n--- CONTEXT START ---\n\n"
            for msg in context_data:
                if isinstance(msg, dict):
                    role = msg.get("role", "unknown").capitalize()
                    content = msg.get("content", "")
                    paragraph += f"{role}: {content}\n\n"
                else:
                    paragraph += f"{msg!s}\n\n"
            paragraph += "--- CONTEXT END ---"
            return paragraph
        elif isinstance(context_data, dict):
            # Handle dictionary data (like table_json)
            if "table_json" in context_data:
                try:
                    table_data = json.loads(context_data["table_json"])
                    paragraph = "The following table data is relevant to your current task. Use it to inform your response.\n\n--- TABLE DATA START ---\n\n"
                    paragraph += f"Title: {table_data.get('table_title', 'N/A')}\n"
                    paragraph += (
                        f"Description: {table_data.get('table_description', 'N/A')}\n\n"
                    )

                    # Add column headers
                    if "columns" in table_data:
                        headers = [
                            col.get("title", col.get("key", "N/A"))
                            for col in table_data["columns"]
                        ]
                        paragraph += "Columns: " + " | ".join(headers) + "\n\n"

                    # Add data rows
                    if "data" in table_data:
                        paragraph += "Data:\n"
                        for row in table_data["data"]:
                            row_values = []
                            for col in table_data.get("columns", []):
                                key = col.get("key")
                                if key and key in row:
                                    row_values.append(str(row[key]))
                            paragraph += " | ".join(row_values) + "\n"

                    paragraph += "\n--- TABLE DATA END ---"
                    return paragraph
                except (json.JSONDecodeError, KeyError) as e:
                    logger.warning(f"Failed to parse table_json: {e}")
                    # Fallback to generic dictionary formatting
                    paragraph = "The following structured data is relevant to your current task. Use it to inform your response.\n\n--- CONTEXT START ---\n\n"
                    paragraph += json.dumps(context_data, indent=2)
                    paragraph += "\n\n--- CONTEXT END ---"
                    return paragraph
            else:
                # Generic dictionary formatting
                paragraph = "The following structured data is relevant to your current task. Use it to inform your response.\n\n--- CONTEXT START ---\n\n"
                paragraph += json.dumps(context_data, indent=2)
                paragraph += "\n\n--- CONTEXT END ---"
                return paragraph
        else:
            # Handle other types (strings, etc.)
            paragraph = "The following information is relevant to your current task. Use it to inform your response.\n\n--- CONTEXT START ---\n\n"
            paragraph += str(context_data)
            paragraph += "\n\n--- CONTEXT END ---"
            return paragraph

    def format_context_content(self, context_content: str) -> str:
        """
        Format context content based on its type.
        This handles both chat summaries and asset transcripts.
        """
        # Check if this looks like a chat summary or asset transcript
        if (
            "role:" in context_content.lower()
            or "user:" in context_content.lower()
            or "assistant:" in context_content.lower()
        ):
            # This appears to be a chat conversation summary
            return f"The following is a summary of a previous conversation that is relevant to your current task. Use it to inform your response.\n\n--- CONTEXT START ---\n\n{context_content}\n\n--- CONTEXT END ---"
        elif (
            "transcript" in context_content.lower()
            or "video" in context_content.lower()
            or "youtube" in context_content.lower()
        ):
            # This appears to be a video/asset transcript
            return f"The following is a transcript from a video/audio source that is relevant to your current task. Use it to inform your response.\n\n--- TRANSCRIPT START ---\n\n{context_content}\n\n--- TRANSCRIPT END ---"
        elif "pdf" in context_content.lower() or "document" in context_content.lower():
            # This appears to be a PDF document context
            return f"The following is content from a PDF document that is relevant to your current task. You also have access to a PDF Q&A tool to answer specific questions about this document.\n\n--- DOCUMENT CONTEXT START ---\n\n{context_content}\n\n--- DOCUMENT CONTEXT END ---"
        else:
            # Generic context
            return f"The following information is relevant to your current task. Use it to inform your response.\n\n--- CONTEXT START ---\n\n{context_content}\n\n--- CONTEXT END ---"

    def process_messages_and_context(
        self, messages: list[dict[str, Any]], dynamic_tools_count: int = 0
    ) -> list[dict[str, Any]]:
        """Process messages and context to create a final system prompt"""
        system_prompt_parts = [self.default_system_prompt]
        processed_messages = []

        # Extract context and existing system messages, and keep other messages
        for msg in messages:
            if msg.get("role") == "context":
                try:
                    # Try to parse as JSON first (for chat conversation summaries)
                    context_data = json.loads(msg["content"])
                    context_paragraph = self.format_context_as_paragraph(context_data)
                    system_prompt_parts.append(context_paragraph)
                except (json.JSONDecodeError, TypeError):
                    # If not JSON, treat as plain text (for asset transcripts)
                    logger.info(
                        f"Processing context as plain text: {msg['content'][:100]}..."
                    )
                    context_paragraph = self.format_context_content(msg["content"])
                    system_prompt_parts.append(context_paragraph)
            elif msg.get("role") == "system":
                system_prompt_parts.append(msg["content"])
            else:
                # Keep user/assistant messages
                processed_messages.append(msg)

        # Add tool-specific guidance
        if dynamic_tools_count > 0:
            system_prompt_parts.append(
                f"You have access to {dynamic_tools_count} PDF document(s) through specialized Q&A tools. When users ask questions about specific documents, use the appropriate PDF tool to get accurate information."
            )

        system_prompt_parts.append(
            "Use web search for current events, general knowledge, or information not available in your connected documents."
        )

        # Combine all system content into one message at the start
        final_system_prompt = "\n\n".join(system_prompt_parts)
        processed_messages.insert(0, {"role": "system", "content": final_system_prompt})

        return processed_messages
