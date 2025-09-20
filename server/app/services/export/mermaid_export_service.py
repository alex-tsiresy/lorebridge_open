from collections.abc import Generator
import re
import json

from sqlalchemy.orm import Session

from app.core.logger import logger
from app.services.ai.llm_input_preparation_service import LLMInputPreparationService
from app.services.ai.llm_manager import get_llm_manager
from app.services.processing.stream_processing_service import StreamProcessingService
from app.services.metrics import EXPORT_ERRORS, EXPORT_PROCESS_SECONDS
from app.services.session.session_validation_service import SessionValidationService

SYSTEM_PROMPT = """
Output ONLY valid Mermaid diagram syntax. No code fences, comments, or explanations.

Start with one of: graph TD | graph LR | sequenceDiagram | classDiagram | stateDiagram-v2 | gantt | erDiagram

Key rules:
- All arrows MUST have descriptive labels: A -->|"description"|B
- Use clear node labels: A["User Login Process"]
- One statement per line
- Group related items in subgraphs when helpful
- Add basic styling with classDef if needed

Examples:
- Flow: A -->|"sends request"|B
- Sequence: User->>API: Login request
- Class: User ||--o{ Order : "places"
"""

class MermaidExportService:
    """
    Mermaid export service orchestrating diagram generation via LLM.
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


    def stream_mermaid_llm(
        self, session_id: str, model: str | None = None, selected_option: dict | None = None
    ) -> Generator[str, None, None]:
        """
        Stream a Mermaid diagram for the given chat session using an LLM.

        Args:
            session_id: Chat session ID
            model: Optional model name (defaults to "gpt-5")

        Yields:
            Mermaid source chunks
        """
        logger.info("[MermaidExport] Starting mermaid generation for session: %s", session_id)

        # Step 1: Validate session and get messages
        messages, error = self._get_validated_messages(session_id)
        if error:
            yield f"%% error: {error}\n"
            return

        # Step 2: Prepare LLM input
        llm_input = self._prepare_llm_input(messages, selected_option)

        # Step 3: Stream LLM response
        model_to_use = model or "gpt-5"
        try:
            logger.info(
                "%s %s",
                "[MermaidExport] LLM streaming request",
                json.dumps(
                    {
                        "session_id": session_id,
                        "model": model_to_use,
                        "message_count": len(llm_input),
                        "messages": llm_input,
                    }
                ),
            )
        except Exception:
            # Best-effort logging only
            pass
        import time as _t
        _start = _t.time()
        try:
            yield from self.stream_processor.stream_llm_response(
                llm_input, model_to_use, session_id
            )
            EXPORT_PROCESS_SECONDS.labels("mermaid", "success").observe(_t.time() - _start)
        except Exception:
            EXPORT_ERRORS.labels("mermaid", "stream_error").inc()
            EXPORT_PROCESS_SECONDS.labels("mermaid", "error").observe(_t.time() - _start)
            raise

    def generate_mermaid_llm(self, session_id: str, model: str | None = None, selected_option: dict | None = None) -> str:
        """
        Generate a full Mermaid diagram string by consuming the stream.

        Args:
            session_id: Chat session ID
            model: Optional model name

        Returns:
            The complete Mermaid source as a single string (without code fences)
        """
        logger.info(
            "[MermaidExport] Generating full mermaid for session: %s", session_id
        )

        chunks: list[str] = []
        for chunk in self.stream_mermaid_llm(session_id, model=model, selected_option=selected_option):
            chunks.append(chunk)

        raw_content = "".join(chunks)
        import time as _t
        _start = _t.time()
        try:
            sanitized = self._sanitize_mermaid_output(raw_content)
            EXPORT_PROCESS_SECONDS.labels("mermaid", "success").observe(_t.time() - _start)
            return sanitized
        except Exception as e:
            EXPORT_ERRORS.labels("mermaid", e.__class__.__name__).inc()
            EXPORT_PROCESS_SECONDS.labels("mermaid", "error").observe(_t.time() - _start)
            raise

    def generate_mermaid_llm_non_streaming(
        self,
        session_id: str,
        model: str | None = None,
        previous_invalid: str | None = None,
        previous_error: str | None = None,
        selected_option: dict | None = None,
    ) -> str:
        """
        Generate a Mermaid diagram using a single, non-streaming LLM call.

        Args:
            session_id: Chat session ID
            model: Optional model name (defaults to "gpt-5")

        Returns:
            The complete Mermaid source as a single string (without code fences)
        """
        logger.info(
            "[MermaidExport] Generating full mermaid (non-streaming) for session: %s",
            session_id,
        )

        # Step 1: Validate session and get messages
        messages, error = self._get_validated_messages(session_id)
        if error:
            logger.error(
                "[MermaidExport] Validation error (non-streaming) for session %s: %s",
                session_id,
                error,
            )
            return ""

        # Step 2: Prepare LLM input
        base_llm_input = self._prepare_llm_input(messages, selected_option)

        # Step 3: Call LLM in non-streaming mode with simple retry on invalid output
        llm_manager = get_llm_manager()
        model_to_use = model or "gpt-4o"

        def call_llm(input_messages: list) -> str:
            try:
                try:
                    logger.info(
                        "%s %s",
                        "[MermaidExport] LLM non-streaming request",
                        json.dumps(
                            {
                                "session_id": session_id,
                                "temperature": 0.3,
                                "model": model_to_use,
                                "max_output_tokens": 10000,
                                "message_count": len(input_messages),
                                "messages": input_messages,
                            }
                        ),
                    )
                except Exception:
                    # Best-effort logging only
                    pass
                response = llm_manager.chat(
                    input=input_messages,
                    model=model_to_use,
                    max_output_tokens=10000,
                )
            except Exception as e:
                logger.error(
                    "[MermaidExport] Error during non-streaming mermaid generation: %s",
                    e,
                    exc_info=True,
                )
                return ""

            # Extract text (no programmatic fixes here; rely on retry)
            try:
                output_text = getattr(response, "output_text", None)
                if output_text is None:
                    output_text = str(response)
            except Exception:
                output_text = str(response)
            return str(output_text)

        # Single-call generation only. Frontend handles retries on render error.
        final_input = list(base_llm_input)
        if previous_invalid or previous_error:
            # On retry, include only the raw failing diagram and the renderer error. No extra instructions.
            minimal_lines: list[str] = []
            if previous_error:
                minimal_lines.append(previous_error)
            if previous_invalid:
                minimal_lines.append("```mermaid")
                minimal_lines.append(previous_invalid)
                minimal_lines.append("```")
            final_input.append({"role": "user", "content": "\n".join(minimal_lines)})
        return call_llm(final_input)

        # First attempt
        mermaid_text = call_llm(base_llm_input)
        if self._looks_like_valid_mermaid(mermaid_text):
            return mermaid_text

        # Retry once with a reinforced system reminder
        logger.warning(
            "[MermaidExport] First attempt produced invalid Mermaid. Retrying with reinforced instructions and previous output context."
        )
        reinforced_input = list(base_llm_input)
        reinforced_input.append(
            {
                "role": "system",
                "content": (
                    "Reminder: Output ONLY Mermaid syntax without code fences. "
                    "Begin immediately with a valid header like 'graph TD' or 'sequenceDiagram'. "
                    "Do not include any explanations or version text. If the previous attempt had a syntax error, correct it. "
                    "Ensure exactly one statement per line and do not chain tokens like ']F -->'. "
                    "Do NOT use semicolons to separate statements; each statement must be on its own line. "
                    "After a label closing ']' or ')', if the next token starts a new node ID (e.g., 'F', 'A1'), put it on a NEW LINE. "
                    "ESCAPING PARENTHESES: Inside labels [ ... ], escape parentheses as \\(" 
                    " and \\)."
                ),
            }
        )
        # Provide the prior invalid output and error details so the model can repair deterministically
        prior_output = previous_invalid or mermaid_text or ""
        try:
            logger.info(
                "%s %s",
                "[MermaidExport] Retry context received",
                json.dumps(
                    {
                        "has_previous_invalid": prior_output != "",
                        "previous_invalid_length": len(prior_output) if prior_output else 0,
                        "has_previous_error": previous_error is not None,
                        "previous_error": previous_error or "",
                    }
                ),
            )
        except Exception:
            pass
        if prior_output or previous_error:
            user_context_lines: list[str] = [
                "The previous Mermaid output failed to render due to a syntax error.",
                "Please correct the syntax and return ONLY the fixed Mermaid diagram (no code fences).",
            ]
            if previous_error:
                user_context_lines.append("Renderer error message:")
                user_context_lines.append(previous_error)
            if prior_output:
                user_context_lines.append("")
                user_context_lines.append("Previous output (for reference):")
                # Deliberately fenced to avoid it being mixed with the new output
                user_context_lines.append(f"```mermaid\n{prior_output}\n```")
            reinforced_input.append(
                {
                    "role": "user",
                    "content": "\n".join(user_context_lines),
                }
            )
        # SUPER OBVIOUS RETRY BANNER
        try:
            banner_lines = [
                "",
                "=" * 100,
                "🚨 MERMAID RETRY INITIATED 🚨",
                f"Session ID: {session_id}",
                f"Model: {model_to_use}",
                f"Has prior invalid output: {bool(prior_output)}",
                f"Prior invalid length: {len(prior_output) if prior_output else 0}",
                f"Has previous error: {previous_error is not None}",
                f"Previous error preview: {(previous_error[:200] if previous_error else '')}",
                "This is the second attempt with reinforced instructions.",
                "=" * 100,
                "",
            ]
            logger.warning("\n".join(banner_lines))
        except Exception:
            pass
        # Log an explicit retry payload preview so we can verify error/output are supplied
        try:
            retry_log_payload = {
                "session_id": session_id,
                "model": model_to_use,
                "is_retry": True,
                "has_previous_invalid": prior_output != "",
                "previous_invalid_length": len(prior_output) if prior_output else 0,
                "previous_invalid_preview": (prior_output[:200] if prior_output else ""),
                "has_previous_error": previous_error is not None,
                "previous_error_preview": (previous_error[:200] if previous_error else ""),
            }
            logger.info("%s %s", "[MermaidExport] LLM retry request context", json.dumps(retry_log_payload))
        except Exception:
            pass
        mermaid_text_retry = call_llm(reinforced_input)
        if self._looks_like_valid_mermaid(mermaid_text_retry):
            try:
                success_banner = [
                    "",
                    "✅ " + ("RETRY SUCCEEDED".center(96, ' ')),
                    f"Output length: {len(mermaid_text_retry or '')}",
                    "" ,
                ]
                logger.warning("\n".join(success_banner))
            except Exception:
                pass
            return mermaid_text_retry

        # Return best-effort (sanitized) even if invalid, allowing client to show error and retry
        try:
            fail_banner = [
                "",
                "❌ " + ("RETRY DID NOT PRODUCE VALID MERMAID".center(86, ' ')),
                f"First attempt length: {len(mermaid_text or '')}",
                f"Retry attempt length: {len(mermaid_text_retry or '')}",
                "Returning best-effort text to client for display and another retry if needed.",
                "",
            ]
            logger.warning("\n".join(fail_banner))
        except Exception:
            pass
        return mermaid_text_retry or mermaid_text

    def _sanitize_mermaid_output(self, text: str) -> str:
        """Best-effort cleanup of LLM output to reduce Mermaid syntax errors.

        - Remove markdown fences and known noise lines
        - Trim to start at the first valid Mermaid header
        - Strip trailing/leading whitespace
        """
        if not text:
            return ""

        content = text.replace("\r\n", "\n")

        # Drop common fence lines and version banners
        noise_prefixes = (
            "```",
            "```mermaid",
            "mermaid version",
        )
        filtered_lines: list[str] = []
        for line in content.split("\n"):
            stripped = line.strip()
            if not stripped:
                filtered_lines.append("")
                continue
            if any(stripped.lower().startswith(p) for p in noise_prefixes):
                continue
            filtered_lines.append(line)

        content = "\n".join(filtered_lines)

        # Keep from the first valid header onwards
        valid_headers = (
            "graph ",
            "sequenceDiagram",
            "classDiagram",
            "stateDiagram-v2",
            "gantt",
            "erDiagram",
            "journey",
        )
        lines = content.split("\n")
        start_index = 0
        for i, line in enumerate(lines):
            l = line.strip()
            if l.startswith("graph ") or l in valid_headers:
                start_index = i
                break
        content = "\n".join(lines[start_index:])

        # Fix common chaining mistake: node closing immediately followed by next statement token
        # e.g., "]F -->" should be "]\nF -->" (newline) or we ensure clean separation. Handle zero-width spaces too.
        try:
            # Insert a hard newline between a closing bracket/paren and the next identifier.
            # Apply repeatedly until stable to fix cascaded chains.
            chaining_pattern = re.compile(r"(\]|\))([\u200B\u200C\u200D\uFEFF\s]*)([A-Za-z0-9_])")
            previous = None
            while previous != content:
                previous = content
                content = chaining_pattern.sub(lambda m: f"{m.group(1)}\n{m.group(3)}", content)
        except Exception:
            # Best-effort; ignore sanitizer errors
            pass

        # Ensure statements are newline-separated and avoid accidental collapsing
        try:
            lines = content.split("\n")
            if lines and lines[0].strip().startswith("graph "):
                updated: list[str] = []
                for line in lines:
                    stripped = line.rstrip()
                    # Do not alter header, subgraph/end lines, classDef lines, comments, or empty lines
                    if (
                        not stripped
                        or stripped.startswith("graph ")
                        or stripped.startswith("subgraph ")
                        or stripped == "end"
                        or stripped.startswith("classDef ")
                        or stripped.startswith("%%")
                    ):
                        updated.append(line)
                        continue
                    # Escape parentheses inside labels like [Text (...)] to \( and \)
                    try:
                        # Replace '(' and ')' only within [...] label segments
                        def escape_parens_in_labels(s: str) -> str:
                            result_chars: list[str] = []
                            in_label = 0
                            for ch in s:
                                if ch == '[':
                                    in_label += 1
                                    result_chars.append(ch)
                                elif ch == ']':
                                    in_label = max(0, in_label - 1)
                                    result_chars.append(ch)
                                elif ch == '(' and in_label > 0:
                                    result_chars.append('\\(')
                                elif ch == ')' and in_label > 0:
                                    result_chars.append('\\)')
                                else:
                                    result_chars.append(ch)
                            return ''.join(result_chars)
                        stripped = escape_parens_in_labels(stripped)
                        # Additional hardening: split chained tokens within a single line (e.g., "]F")
                        stripped = re.sub(r"(\]|\))\s*([A-Za-z0-9_])", r"\1\n\2", stripped)
                    except Exception:
                        pass
                    # Ensure we keep the processed line as-is (no semicolons appended)
                    updated.append(stripped)
                content = "\n".join(updated)
        except Exception:
            pass

        return content.strip()

    def _looks_like_valid_mermaid(self, text: str) -> bool:
        """Lightweight heuristic to check if the output resembles valid Mermaid.

        This avoids executing Mermaid and instead checks for:
        - Starts with a known header
        - Contains at least a plausible diagram body indicator
        """
        if not text:
            return False

        content = text.strip()
        headers = (
            "graph ",
            "sequenceDiagram",
            "classDiagram",
            "stateDiagram-v2",
            "gantt",
            "erDiagram",
            "journey",
        )
        starts_with_header = any(
            content.startswith("graph ") or content.startswith(h) for h in headers
        )
        if not starts_with_header:
            return False

        # Body indicators
        indicators = (
            "-->",  # edges
            "-.->",
            "---",
            "participant ",
            "class ",
            "state ",
            "section ",
            "{" ,  # class or ER bodies
        )
        if not any(ind in content for ind in indicators):
            return False

        # Consider invalid if we still see chaining like "]F" or ")F" without a newline
        if re.search(r"(\]|\))\s*[A-Za-z0-9_]", content):
            return False

        return True

    def _get_validated_messages(self, session_id: str) -> tuple[list, str | None]:
        """Get validated session messages or return error."""
        # Validate session exists
        _session, error = self.session_validator.validate_and_get_session(session_id)
        if error:
            return [], error

        # Get session messages
        messages, error = self.session_validator.get_session_messages(session_id)
        if error:
            return [], error

        return messages, None

    def _prepare_llm_input(self, messages: list, selected_option: dict | None = None) -> list:
        """Prepare LLM input from messages, with optional user-selected guidance."""
        chat_history = self.input_preparer.prepare_chat_history(messages)
        llm_input = self.input_preparer.build_llm_input_messages(
            chat_history, system_prompt=SYSTEM_PROMPT
        )
        if selected_option:
            try:
                guidance = json.dumps(selected_option)
            except Exception:
                guidance = str(selected_option)
            llm_input.append({
                "role": "user",
                "content": [{"type": "input_text", "text": f"User-selected processing guidance for mermaid (JSON):\n{guidance}"}],
            })
        return llm_input
