import json
import threading
import time
import uuid

from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models.chat_message import ChatMessage
from app.db.models.chat_session import ChatSession

# Metrics: prefer dynamic import to avoid linter import errors in limited envs
class _NoopMetric:
    def labels(self, *_, **__):
        return self

    def inc(self, *_, **__):
        return None

    def observe(self, *_, **__):
        return None

EXPORT_ERRORS = _NoopMetric()
EXPORT_PROCESS_SECONDS = _NoopMetric()

try:  # pragma: no cover
    import importlib
    _metrics_mod = importlib.import_module("app.services.metrics")
    EXPORT_ERRORS = getattr(_metrics_mod, "EXPORT_ERRORS", EXPORT_ERRORS)
    EXPORT_PROCESS_SECONDS = getattr(_metrics_mod, "EXPORT_PROCESS_SECONDS", EXPORT_PROCESS_SECONDS)
except Exception:
    pass


# Thread-safe cache for deduplication
_request_cache: dict[str, float] = {}
_cache_lock = threading.Lock()


# JSON schema returned by the LLM function-call
PROCESSING_OPTIONS_SCHEMA = {
    "type": "object",
    "properties": {
        "output_type": {
            "type": "string",
            "enum": ["table", "markdown", "mermaid"],
        },
        "detected_subjects": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Short list of key subjects/topics found in the context.",
        },
        "primary_option_id": {
            "type": "string",
            "description": "The top recommended option id when a single next step is best (optional)",
        },
        "options": {
            "type": "array",
            "description": "Suggested actions for the user to take next.",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "Stable, URL-safe identifier"},
                    "title": {"type": "string"},
                    "intent": {
                        "type": "string",
                        "enum": [
                            "delve",
                            "investigate",
                            "explain",
                            "summarize",
                            "contrast",
                            "compare",
                            "map_flow",
                            "timeline",
                            "synthesize",
                            "counterpoint",
                            "plan",
                            "hypothesize",
                            "explore_alternatives",
                        ],
                    },
                    "scope": {
                        "type": "string",
                        "enum": ["subject", "cross_subject", "holistic"],
                        "description": "Whether this option targets a single subject, spans multiple subjects, or synthesizes the whole context",
                    },
                    "subjects": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Subject(s) this option applies to (optional)",
                    },
                    "description": {"type": "string"},
                    "follow_up_prompt": {
                        "type": "string",
                        "description": "A ready-to-send follow-up prompt tailored to the chosen intent",
                    },
                    "relevance_score": {"type": "number", "minimum": 0, "maximum": 1},
                    "estimated_complexity": {
                        "type": "string",
                        "enum": ["low", "medium", "high"],
                    },
                    "output_hints": {
                        "type": "object",
                        "description": "Type-specific hints (columns/axes for table, outline for markdown, graph specs for mermaid)",
                        "additionalProperties": True,
                    },
                },
                "required": [
                    "id",
                    "title",
                    "intent",
                    "description",
                    "follow_up_prompt",
                    "relevance_score",
                    "estimated_complexity",
                ],
            },
        },
    },
    "required": ["output_type", "options"],
}


BASE_SYSTEM_PROMPT = """
You are an assistant that proposes the most useful next actions based on a conversation context.

Your output is a JSON object with: output_type, detected_subjects, and options[]. Each option represents a concrete, high‑quality next step the user can take: to delve deeper, investigate, explain, or summarize a specific topic from the context. If multiple subjects are present (e.g., A, B, C), propose targeted options for each. If only one subject exists, include options like summary vs. deep dive vs. alternative perspective. Always remain flexible: include at least one option to explore counterpoints or uncertainties if any are present.

QUALITY BAR FOR OPTIONS
- Be specific about the subject and angle
- Avoid redundancy; ensure diversity (e.g., contrast vs. summarize vs. investigate root cause)
- Provide short but clear descriptions
- Include a ready-to-send follow_up_prompt
 
FLEXIBILITY & HOLISTIC CONTEXTS
- Do NOT force segmentation if the conversation is homogeneous/holistic. In such cases, propose holistic options that synthesize, frame trade‑offs, or produce a single cohesive artifact.
- Use option.scope = "holistic" for synthesis‑level options; use "cross_subject" when an option spans multiple subjects; otherwise "subject".
- Populate option.subjects when relevant (optional).
- If one path stands out, set primary_option_id to the recommended option.
""".strip()


TABLE_HINTS = """
CONTEXT → TABLE OPTIONS (for output_type="table")
- Identify information that can be tabulated, contrasted, or compared (features, pros/cons, criteria, timelines, metrics).
- Include options that define comparison axes (e.g., cost, performance, complexity, risk, priority, timeline).
- Propose column sets and any sorting/filtering hints under output_hints.columns or output_hints.comparison_axes.
- For holistic contexts, consider framework matrices (e.g., Decision Matrix, RICE, MoSCoW, SWOT) and synthesis tables.
""".strip()


MARKDOWN_HINTS = """
CONTEXT → MARKDOWN NOTE OPTIONS (for output_type="markdown")
- Offer structured notes: executive summary, thematic outline, explanation of a tricky concept, step-by-step plan, FAQ.
- Provide a suggested outline under output_hints.outline (list of headings).
- For holistic contexts, favor a single cohesive narrative: synthesis, key insights, trade-offs, and recommended next steps.
""".strip()


MERMAID_HINTS = """
CONTEXT → MERMAID DIAGRAM OPTIONS (for output_type="mermaid")
- Ask for the most appropriate diagram type from the context (flowchart, sequence diagram, class diagram, state diagram, timeline, mindmap).
- Specify the subject and scope. Include output_hints.graph_type and a short list of key nodes/edges or lifelines.
- For holistic contexts, consider concept maps or mindmaps; for cross-subject relationships, consider dependency graphs.
""".strip()


def _build_system_prompt(output_type: str) -> str:
    type_block = {
        "table": TABLE_HINTS,
        "markdown": MARKDOWN_HINTS,
        "mermaid": MERMAID_HINTS,
    }.get(output_type, "")
    return f"{BASE_SYSTEM_PROMPT}\n\n{type_block}".strip()


class ProcessingOptionsService:
    """
    Generate structured processing options based on a chat session context and a desired
    output type (table | markdown | mermaid).
    """

    def __init__(self, db: Session, model_name: str = "gpt-4o-mini"):
        self.db = db
        self.model_name = model_name
        # Lazy-import LangChain types and client
        self.langchain_available = True
        self._init_error: str | None = None
        try:
            import importlib
            _lc_models = importlib.import_module("langchain_community.chat_models")
            _lc_msgs = importlib.import_module("langchain_core.messages")
            _ChatOpenAI = getattr(_lc_models, "ChatOpenAI")
            _AIMessage = getattr(_lc_msgs, "AIMessage")
            _HumanMessage = getattr(_lc_msgs, "HumanMessage")
            _SystemMessage = getattr(_lc_msgs, "SystemMessage")
            self._AIMessage = _AIMessage
            self._HumanMessage = _HumanMessage
            self._SystemMessage = _SystemMessage
            self.llm = _ChatOpenAI(
                model_name=model_name,
                temperature=0.2,
                streaming=True,
                openai_api_key=settings.OPENAI_API_KEY,
            )
        except Exception as e:  # pragma: no cover
            self.langchain_available = False
            self._init_error = f"LangChain unavailable: {e!s}"
        self.functions = [
            {
                "name": "suggest_processing_options",
                "description": "Suggest actionable processing options for the given context and output type.",
                "parameters": PROCESSING_OPTIONS_SCHEMA,
            }
        ]

    def _is_in_progress(self, key: str) -> bool:
        with _cache_lock:
            ts = _request_cache.get(key)
            return bool(ts and (time.time() - ts) < 30)

    def _mark_start(self, key: str):
        with _cache_lock:
            _request_cache[key] = time.time()

    def _mark_end(self, key: str):
        with _cache_lock:
            _request_cache.pop(key, None)

    def _get_session_messages(self, session_id: str) -> tuple[list[ChatMessage], str | None]:
        try:
            uid = uuid.UUID(session_id)
        except ValueError:
            return [], f"Invalid session ID: {session_id}"

        session = self.db.query(ChatSession).get(uid)
        if not session:
            return [], f"Session not found: {session_id}"

        msgs = (
            self.db.query(ChatMessage)
            .filter(ChatMessage.chat_session_id == uid)
            .order_by(ChatMessage.timestamp)
            .all()
        )
        if not msgs:
            return [], "Empty session"
        return msgs, None

    def get_session_processing_options_json(self, session_id: str, output_type: str) -> dict:
        """
        Non-streaming: returns full JSON options by invoking the suggest_processing_options function.
        """
        normalized_type = (output_type or "").strip().lower()
        if normalized_type in {"markdown note", "note"}:
            normalized_type = "markdown"
        if normalized_type in {"mermaid diagram", "diagram"}:
            normalized_type = "mermaid"
        if normalized_type not in {"table", "markdown", "mermaid"}:
            return {"error": f"Unsupported output_type: {output_type}"}

        key = f"process_opts_{normalized_type}_{session_id}"
        if self._is_in_progress(key):
            return {"error": "Processing. Please retry shortly."}
        self._mark_start(key)

        # Fetch messages
        msgs, error = self._get_session_messages(session_id)
        if error:
            self._mark_end(key)
            return {"error": error}

        chat_text = "\n".join([f"{m.role or 'user'}: {m.content}" for m in msgs])
        sys_prompt = _build_system_prompt(normalized_type)
        messages = [
            self._SystemMessage(content=sys_prompt),
            self._HumanMessage(content=(
                "You will propose options for output_type='" + normalized_type + "'.\n" \
                "Context transcript:\n" + chat_text
            )),
        ]

        start_time = time.time()
        try:
            response = self.llm(
                input=messages,
                functions=self.functions,
                function_call={"name": "suggest_processing_options"},
            )
            EXPORT_PROCESS_SECONDS.labels("processing_options", "success").observe(time.time() - start_time)
        except Exception as e:
            EXPORT_ERRORS.labels("processing_options", e.__class__.__name__).inc()
            EXPORT_PROCESS_SECONDS.labels("processing_options", "error").observe(time.time() - start_time)
            self._mark_end(key)
            return {"error": f"LLM error: {e!s}"}

        # Extract function arguments as JSON
        func_payload = response.content if hasattr(response, "content") else None
        result: dict
        try:
            result = json.loads(func_payload)
        except Exception:
            result = {"error": "Failed to parse options JSON."}

        self._mark_end(key)
        return result

    def stream_session_processing_options_json(self, session_id: str, output_type: str):
        """Yield chunks of JSON text as produced by the LLM for processing options."""
        normalized_type = (output_type or "").strip().lower()
        if normalized_type in {"markdown note", "note"}:
            normalized_type = "markdown"
        if normalized_type in {"mermaid diagram", "diagram"}:
            normalized_type = "mermaid"
        if normalized_type not in {"table", "markdown", "mermaid"}:
            yield json.dumps({"error": f"Unsupported output_type: {output_type}"})
            return

        key = f"process_opts_{normalized_type}_{session_id}"
        if self._is_in_progress(key):
            yield json.dumps({"error": "Processing. Please retry shortly."})
            return

        self._mark_start(key)

        try:
            msgs, error = self._get_session_messages(session_id)
            if error:
                yield json.dumps({"error": error})
                return

            chat_text = "\n".join([f"{m.role or 'user'}: {m.content}" for m in msgs])
            sys_prompt = _build_system_prompt(normalized_type)
            messages = [
                self._SystemMessage(content=sys_prompt),
                self._HumanMessage(content=(
                    "You will propose options for output_type='" + normalized_type + "'.\n"
                    "Context transcript:\n" + chat_text
                )),
            ]

            start_time = time.time()

            stream = self.llm.stream(
                input=messages,
                functions=self.functions,
                function_call={"name": "suggest_processing_options"},
            )

            for chunk in stream:
                if hasattr(chunk, "additional_kwargs") and "function_call" in chunk.additional_kwargs:
                    function_call = chunk.additional_kwargs["function_call"]
                    if "arguments" in function_call:
                        yield function_call["arguments"]
                elif hasattr(chunk, "content") and chunk.content:
                    yield chunk.content

            try:
                EXPORT_PROCESS_SECONDS.labels("processing_options", "success").observe(time.time() - start_time)
            except Exception:
                pass
        except Exception as e:
            yield json.dumps({"error": f"Error during streaming: {e!s}"})
        finally:
            self._mark_end(key)


