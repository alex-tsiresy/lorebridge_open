import json
import threading
import time
import uuid

from langchain_community.chat_models import ChatOpenAI
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models.chat_message import ChatMessage
from app.db.models.chat_session import ChatSession
from app.services.metrics import EXPORT_ERRORS, EXPORT_PROCESS_SECONDS

# JSON Schema for structured table output
TABLE_SCHEMA = {
    "type": "object",
    "properties": {
        "table_title": {"type": "string"},
        "table_description": {"type": "string"},
        "columns": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "key": {"type": "string"},
                    "title": {"type": "string"},
                    "type": {"type": "string"},
                    "width": {"type": "string"},
                    "sortable": {"type": "boolean"},
                    "filterable": {"type": "boolean"},
                },
                "required": ["key", "title", "type", "width", "sortable", "filterable"],
            },
        },
        "data": {
            "type": "array",
            "items": {"type": "object", "additionalProperties": True},
        },
        "metadata": {
            "type": "object",
            "properties": {
                "total_rows": {"type": "integer"},
                "total_columns": {"type": "integer"},
                "has_filters": {"type": "boolean"},
                "has_sorting": {"type": "boolean"},
                "table_type": {"type": "string"},
            },
            "required": [
                "total_rows",
                "total_columns",
                "has_filters",
                "has_sorting",
                "table_type",
            ],
        },
    },
    "required": ["table_title", "table_description", "columns", "data", "metadata"],
}

# System prompt for table generation
SYSTEM_PROMPT = """You are an expert data analyst and visualization specialist. Your goal is to create compelling, insightful tables that transform chat conversations into meaningful data presentations.

**ANALYSIS APPROACH:**
1. **Identify Key Themes**: Look for recurring topics, comparisons, lists, timelines, or structured information
2. **Extract Relationships**: Find connections between entities, concepts, or data points
3. **Discover Patterns**: Identify trends, categories, hierarchies, or classifications
4. **Uncover Insights**: Look for quantitative data, rankings, scores, or measurable attributes

**TABLE TYPES TO CONSIDER:**
- **Comparison Tables**: Side-by-side analysis of entities, features, or options
- **Timeline Tables**: Chronological sequences with dates, events, and milestones
- **Categorical Tables**: Grouped data with categories, subcategories, and attributes
- **Summary Tables**: Aggregated data with totals, averages, or key metrics
- **Detailed Tables**: Comprehensive breakdowns with multiple attributes per item
- **Analysis Tables**: Data with calculated fields, ratios, or derived metrics
- **Feature Tables**: Product/service comparisons with feature matrices
- **Process Tables**: Step-by-step workflows with inputs, outputs, and dependencies
- **Resource Tables**: Lists of tools, links, or references with metadata
- **Status Tables**: Progress tracking with states, priorities, and completion rates

**DATA ENRICHMENT STRATEGIES:**
- **Add Calculated Fields**: Include derived metrics, ratios, or percentages
- **Create Categories**: Group related items with meaningful classifications
- **Include Metadata**: Add source information, confidence scores, or timestamps
- **Provide Context**: Include descriptions, explanations, or additional context
- **Use Visual Indicators**: Boolean fields for quick status identification
- **Add Rankings**: Include priority, importance, or performance scores

**COLUMN DESIGN PRINCIPLES:**
- **Meaningful Headers**: Use clear, descriptive column titles
- **Appropriate Types**: Choose string, number, date, boolean, or array based on data
- **Logical Ordering**: Arrange columns from most important to supporting information
- **Consistent Formatting**: Use standardized formats for dates, numbers, and text
- **Actionable Data**: Include fields that enable decision-making or analysis

**QUALITY CRITERIA:**
- **Relevance**: Table should capture the most important information from the conversation
- **Completeness**: Include all relevant data points and relationships
- **Clarity**: Structure should be immediately understandable
- **Insight**: Table should reveal patterns or insights not obvious in raw conversation
- **Actionability**: Data should support decision-making or next steps

**SPECIAL CONSIDERATIONS:**
- **Nested Data**: Use array types for complex relationships or multiple values
- **Conditional Formatting**: Use boolean fields to highlight important statuses
- **Progressive Disclosure**: Start with key columns, add detail columns as needed
- **Cross-References**: Include IDs or references to connect related data
- **Temporal Context**: Add timestamps or time-based classifications where relevant

Analyze the chat transcript and return a JSON object adhering to TABLE_SCHEMA with keys: table_title, table_description, columns, data, metadata. Focus on creating the most insightful and useful table representation of the conversation data."""

# Thread-safe cache for deduplication
_request_cache = {}
_cache_lock = threading.Lock()


class TableExportService:
    def __init__(self, db: Session, model_name: str = "gpt-4o-mini"):
        self.db = db
        # Streaming-enabled OpenAI client via LangChain
        self.llm = ChatOpenAI(
            model_name=model_name,
            temperature=0.3,
            streaming=True,
            openai_api_key=settings.OPENAI_API_KEY
        )
        # Define function schema once for strict compliance
        self.functions = [
            {
                "name": "generate_table",
                "description": "Produce a structured table JSON from chat transcript.",
                "parameters": TABLE_SCHEMA,
            }
        ]

    def _is_in_progress(self, session_id: str) -> bool:
        key = f"table_{session_id}"
        with _cache_lock:
            ts = _request_cache.get(key)
            return bool(ts and (time.time() - ts) < 30)

    def _mark_start(self, session_id: str):
        with _cache_lock:
            _request_cache[f"table_{session_id}"] = time.time()

    def _mark_end(self, session_id: str):
        with _cache_lock:
            _request_cache.pop(f"table_{session_id}", None)

    def get_session_table_json(self, session_id: str, selected_option: dict | None = None) -> dict:
        """
        Non-streaming: returns full JSON table by invoking the generate_table function.
        """
        if self._is_in_progress(session_id):
            return {"error": "Processing. Please retry shortly."}
        self._mark_start(session_id)

        # Validate session ID
        try:
            uid = uuid.UUID(session_id)
        except ValueError:
            return {"error": f"Invalid session ID: {session_id}"}

        # Fetch messages
        session = self.db.query(ChatSession).get(uid)
        if not session:
            return {"error": f"Session not found: {session_id}"}
        msgs = (
            self.db.query(ChatMessage)
            .filter(ChatMessage.chat_session_id == uid)
            .order_by(ChatMessage.timestamp)
            .all()
        )
        if not msgs:
            self._mark_end(session_id)
            return {"table_title": "Empty", "data": []}

        # Build LangChain messages
        chat_text = "\n".join([f"{m.role or 'user'}: {m.content}" for m in msgs])
        messages = [
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=f"Chat transcript:\n{chat_text}"),
        ]
        if selected_option:
            try:
                guidance_json = json.dumps(selected_option)
            except Exception:
                guidance_json = str(selected_option)
            messages.append(
                HumanMessage(
                    content=(
                        "User-selected processing guidance for table generation (JSON):\n" + guidance_json
                    )
                )
            )

        # Call LLM with function-calling
        import time
        start_time = time.time()
        try:
            response = self.llm(
                input=messages,
                functions=self.functions,
                function_call={"name": "generate_table"},
            )
            EXPORT_PROCESS_SECONDS.labels("table", "success").observe(time.time() - start_time)
        except Exception as e:
            EXPORT_ERRORS.labels("table", e.__class__.__name__).inc()
            EXPORT_PROCESS_SECONDS.labels("table", "error").observe(time.time() - start_time)
            self._mark_end(session_id)
            return {"error": f"LLM error: {e!s}"}

        # Extract function arguments as JSON
        func_call = response.content if isinstance(response, AIMessage) else None
        result = {}
        try:
            result = json.loads(func_call)
        except Exception:
            result = {"error": "Failed to parse table JSON."}

        self._mark_end(session_id)
        return result

    def stream_session_table_json(self, session_id: str, selected_option: dict | None = None):
        """Yield chunks of JSON text as produced by the LLM."""
        if self._is_in_progress(session_id):
            yield json.dumps({"error": "Processing. Please retry shortly."})
            return

        self._mark_start(session_id)

        try:
            import time
            start_time = time.time()
            # Validate session ID
            try:
                uid = uuid.UUID(session_id)
            except ValueError:
                yield json.dumps({"error": f"Invalid session ID: {session_id}"})
                return

            # Fetch messages
            session = self.db.query(ChatSession).get(uid)
            if not session:
                yield json.dumps({"error": f"Session not found: {session_id}"})
                return

            msgs = (
                self.db.query(ChatMessage)
                .filter(ChatMessage.chat_session_id == uid)
                .order_by(ChatMessage.timestamp)
                .all()
            )
            if not msgs:
                self._mark_end(session_id)
                yield json.dumps({"table_title": "Empty", "data": []})
                return

            # Build LangChain messages
            chat_text = "\n".join([f"{m.role or 'user'}: {m.content}" for m in msgs])
            messages = [
                SystemMessage(content=SYSTEM_PROMPT),
                HumanMessage(content=f"Chat transcript:\n{chat_text}"),
            ]
            if selected_option:
                try:
                    guidance_json = json.dumps(selected_option)
                except Exception:
                    guidance_json = str(selected_option)
                messages.append(
                    HumanMessage(
                        content=(
                            "User-selected processing guidance for table generation (JSON):\n" + guidance_json
                        )
                    )
                )

            # Stream tokens
            stream = self.llm.stream(
                input=messages,
                functions=self.functions,
                function_call={"name": "generate_table"},
            )

            for chunk in stream:
                if (
                    hasattr(chunk, "additional_kwargs")
                    and "function_call" in chunk.additional_kwargs
                ):
                    function_call = chunk.additional_kwargs["function_call"]
                    if "arguments" in function_call:
                        yield function_call["arguments"]
                elif hasattr(chunk, "content") and chunk.content:
                    yield chunk.content

        except Exception as e:
            yield json.dumps({"error": f"Error during streaming: {e!s}"})
        finally:
            try:
                EXPORT_PROCESS_SECONDS.labels("table", "success").observe(time.time() - start_time)
            except Exception:
                pass
            self._mark_end(session_id)

    def stream_session_table_json_structured(
        self, session_id: str, model: str | None = None, selected_option: dict | None = None
    ):
        """
        Streaming method that maintains compatibility with existing API.
        Uses the same LangChain approach as stream_session_table_json.
        """
        # Use the model parameter if provided, otherwise use default
        if model and model != "gpt-4o-mini":
            # Create a new LLM instance with the specified model
            llm = ChatOpenAI(model_name=model, temperature=0.3, streaming=True)
        else:
            llm = self.llm

        if self._is_in_progress(session_id):
            yield json.dumps({"error": "Processing. Please retry shortly."})
            return

        self._mark_start(session_id)

        try:
            import time
            start_time = time.time()
            # Validate session ID
            try:
                uid = uuid.UUID(session_id)
            except ValueError:
                yield json.dumps({"error": f"Invalid session ID: {session_id}"})
                return

            # Fetch messages
            session = self.db.query(ChatSession).get(uid)
            if not session:
                yield json.dumps({"error": f"Session not found: {session_id}"})
                return

            msgs = (
                self.db.query(ChatMessage)
                .filter(ChatMessage.chat_session_id == uid)
                .order_by(ChatMessage.timestamp)
                .all()
            )
            if not msgs:
                self._mark_end(session_id)
                yield json.dumps({"table_title": "Empty", "data": []})
                return

            # Build LangChain messages
            chat_text = "\n".join([f"{m.role or 'user'}: {m.content}" for m in msgs])
            messages = [
                SystemMessage(content=SYSTEM_PROMPT),
                HumanMessage(content=f"Chat transcript:\n{chat_text}"),
            ]
            if selected_option:
                try:
                    guidance_json = json.dumps(selected_option)
                except Exception:
                    guidance_json = str(selected_option)
                messages.append(
                    HumanMessage(
                        content=(
                            "User-selected processing guidance for table generation (JSON):\n" + guidance_json
                        )
                    )
                )

            # Stream tokens
            stream = llm.stream(
                input=messages,
                functions=self.functions,
                function_call={"name": "generate_table"},
            )

            for chunk in stream:
                if (
                    hasattr(chunk, "additional_kwargs")
                    and "function_call" in chunk.additional_kwargs
                ):
                    function_call = chunk.additional_kwargs["function_call"]
                    if "arguments" in function_call:
                        yield function_call["arguments"]
                elif hasattr(chunk, "content") and chunk.content:
                    yield chunk.content

        except Exception as e:
            yield json.dumps({"error": f"Error during streaming: {e!s}"})
        finally:
            try:
                EXPORT_PROCESS_SECONDS.labels("table", "success").observe(time.time() - start_time)
            except Exception:
                pass
            self._mark_end(session_id)
