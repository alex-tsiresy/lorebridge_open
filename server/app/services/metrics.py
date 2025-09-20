"""
Prometheus metrics used across the service layer.

These metrics focus on Large Language Model (LLM) interactions so that
we can track call volume, latency, token usage, and error rates per model
and provider.

If ``prometheus_client`` is not installed (e.g. in certain dev/test
environments), metrics become no-ops to avoid import errors.
"""

try:  # pragma: no cover - optional dependency in some environments
    import importlib
    _prom = importlib.import_module("prometheus_client")
    Counter = getattr(_prom, "Counter")
    Histogram = getattr(_prom, "Histogram")
except ImportError:  # pragma: no cover
    # Provide no-op fallbacks so imports do not fail where Prometheus isn't installed
    class _NoopMetric:
        def labels(self, *_, **__):
            return self

        def inc(self, *_, **__):
            return None

        def observe(self, *_, **__):
            return None

    def Counter(*_, **__):  # type: ignore
        return _NoopMetric()

    def Histogram(*_, **__):  # type: ignore
        return _NoopMetric()


# Total number of LLM calls by model, provider, and endpoint (e.g., chat, chat_stream)
LLM_CALLS = Counter(
    "llm_calls_total",
    "Total number of LLM calls",
    labelnames=["model", "provider", "endpoint"],
)


# Token usage separated by prompt vs completion, with model and provider
LLM_TOKENS = Counter(
    "llm_tokens_total",
    "Total LLM tokens used",
    labelnames=["model", "provider", "type"],
)


# Latency of LLM calls in seconds by model, provider, and endpoint
LLM_LATENCY = Histogram(
    "llm_latency_seconds",
    "LLM call latency in seconds",
    labelnames=["model", "provider", "endpoint"],
)


# Errors encountered when calling LLMs, reason is usually exception class name
LLM_ERRORS = Counter(
    "llm_errors_total",
    "Total LLM errors",
    labelnames=["model", "provider", "reason"],
)


# --- Domain/business metrics ---

# Artefacts
ARTEFACTS_CREATED = Counter(
    "artefacts_created_total",
    "Number of artefacts created",
    labelnames=["type"],
)

ARTEFACT_PROCESSING_SECONDS = Histogram(
    "artefact_processing_seconds",
    "Time spent processing artefacts",
    labelnames=["type", "result"],  # result: success|error
)

ARTEFACT_ERRORS = Counter(
    "artefact_errors_total",
    "Errors during artefact processing",
    labelnames=["type", "reason"],
)

# Assets (e.g., PDFs)
ASSET_INGEST_SECONDS = Histogram(
    "asset_ingest_seconds",
    "Time from request to scheduling/processing for asset ingestion",
    labelnames=["type", "result"],  # result: success|error
)

ASSET_INGEST_ERRORS = Counter(
    "asset_ingest_errors_total",
    "Errors during asset ingestion",
    labelnames=["type", "reason"],
)

# Web crawling
CRAWL_JOBS_SECONDS = Histogram(
    "crawl_jobs_seconds",
    "Duration of web crawling jobs",
    labelnames=["result"],  # result: success|error
)

CRAWL_JOB_ERRORS = Counter(
    "crawl_job_errors_total",
    "Errors during web crawling jobs",
    labelnames=["reason"],
)

# Export services (markdown, table, mermaid)
EXPORT_PROCESS_SECONDS = Histogram(
    "export_process_seconds",
    "Duration of export service operations",
    labelnames=["export_type", "result"],  # export_type: markdown|table|mermaid
)

EXPORT_ERRORS = Counter(
    "export_errors_total",
    "Errors in export services",
    labelnames=["export_type", "reason"],
)

# LangChain streaming
LANGCHAIN_STREAM_SECONDS = Histogram(
    "langchain_stream_seconds",
    "Duration of LangChain streaming sessions",
    labelnames=["result"],  # result: success|error
)

LANGCHAIN_ERRORS = Counter(
    "langchain_errors_total",
    "Errors in LangChain services",
    labelnames=["reason"],
)

# LangGraph-specific LLM usage (via LangChain)
LANGGRAPH_LLM_CALLS = Counter(
    "langgraph_llm_calls_total",
    "Total number of LangGraph LLM invocations",
    labelnames=["model"],
)

LANGGRAPH_TOKENS = Counter(
    "langgraph_tokens_total",
    "Total tokens used by LangGraph LLM (prompt vs completion)",
    labelnames=["model", "type"],  # type: prompt|completion
)


