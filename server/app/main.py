from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
try:
    from prometheus_fastapi_instrumentator import Instrumentator  # type: ignore
    _PROM_AVAILABLE = True
except Exception:  # pragma: no cover - optional in dev
    Instrumentator = None  # type: ignore
    _PROM_AVAILABLE = False
import os

from app.api.v1.endpoints import (
    agent_routes,
    artefact_router,
    asset_router,
    chat_router,
    edge_router,
    graph_router,
    health_router,
    langchain_llm_router,
    node_router,
    stripe_webhook_router,
    subscription_router,
    user_routes,
    webhook_routes,
)
from app.api.v1.endpoints.llm import router as llm_router
from app.core.config import settings
from app.core.logger import logger
from app.core.rate_limiter import limiter, rate_limit_exceeded_handler
from app.core.logging_middleware import LoggingMiddleware
from slowapi.errors import RateLimitExceeded

# --- OpenTelemetry ---
try:
    from opentelemetry import trace  # type: ignore
    from opentelemetry.sdk.resources import Resource  # type: ignore
    from opentelemetry.sdk.trace import TracerProvider  # type: ignore
    from opentelemetry.sdk.trace.export import BatchSpanProcessor  # type: ignore
    from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import (
        OTLPSpanExporter,  # type: ignore
    )
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor  # type: ignore
    from opentelemetry.instrumentation.asgi import OpenTelemetryMiddleware  # type: ignore
    _OTEL_AVAILABLE = True
except Exception:  # pragma: no cover - optional in dev
    trace = None  # type: ignore
    TracerProvider = None  # type: ignore
    BatchSpanProcessor = None  # type: ignore
    OTLPSpanExporter = None  # type: ignore
    FastAPIInstrumentor = None  # type: ignore
    OpenTelemetryMiddleware = None  # type: ignore
    Resource = None  # type: ignore
    _OTEL_AVAILABLE = False

provider = None
if _OTEL_AVAILABLE and os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT"):
    service_name = os.getenv("OTEL_SERVICE_NAME", "lorebridge-api")
    resource = Resource.create({"service.name": service_name})
    provider = TracerProvider(resource=resource)
    processor = BatchSpanProcessor(OTLPSpanExporter())
    provider.add_span_processor(processor)
    trace.set_tracer_provider(provider)
from app.services.ai.llm_manager import LLMManager, get_llm_manager

app = FastAPI(
    title=settings.APP_NAME,
    description="A FastAPI application powered by a strand agent.",
    version="0.1.0",
)

# Configure rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

# Add logging middleware for request tracking
app.add_middleware(LoggingMiddleware)

# Prometheus metrics
if _PROM_AVAILABLE and Instrumentator:
    Instrumentator().instrument(app).expose(app, include_in_schema=False)

# OpenTelemetry auto-instrumentation for FastAPI/ASGI
if _OTEL_AVAILABLE and provider:
    FastAPIInstrumentor.instrument_app(app, tracer_provider=provider)
    app.add_middleware(OpenTelemetryMiddleware, tracer_provider=provider)

# Add CORS middleware with secure configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,  # Use settings configuration
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],  # Be specific about allowed methods
    allow_headers=["Authorization", "Content-Type", "Accept"],  # Be specific about allowed headers
)

# Create a shared LLMManager instance
llm_mgr = LLMManager(default=settings.DEFAULT_LLM)


def get_llm_manager_override():
    return llm_mgr


@app.on_event("startup")
async def startup_event():
    print(f"LoreBridge Application '{settings.APP_NAME}' startup completed.")
    # Initialize your agent here if it needs a global instance or resources.
    # from app.agents.my_strand_agent import MyStrandAgent
    # global_agent_instance = MyStrandAgent()
    logger.info("Starting LLM Backbone API...")


# Override the get_llm_manager dependency globally
app.dependency_overrides[get_llm_manager] = get_llm_manager_override

app.include_router(agent_routes.router, prefix="/api/v1", tags=["Agent"])
app.include_router(user_routes.router, prefix="/api/v1/users", tags=["Users"])
app.include_router(webhook_routes.router, prefix="/api/v1/webhooks", tags=["Webhooks"])

# Include the LLM router
app.include_router(llm_router, prefix="/api/v1")
app.include_router(langchain_llm_router, prefix="/api/v1", tags=["LangChainLLM"])

# Register new canvas workspace routers
app.include_router(graph_router, prefix="/api/v1", tags=["Graph"])
app.include_router(node_router, prefix="/api/v1", tags=["Node"])
app.include_router(edge_router, prefix="/api/v1", tags=["Edge"])
app.include_router(asset_router, prefix="/api/v1", tags=["Asset"])
app.include_router(artefact_router, prefix="/api/v1", tags=["Artefact"])
app.include_router(chat_router, prefix="/api/v1", tags=["Chat"])

# Register health monitoring routes
app.include_router(health_router, prefix="/api/v1", tags=["Health"])

# Register Stripe subscription routers
app.include_router(
    subscription_router, prefix="/api/v1/subscriptions", tags=["Subscriptions"]
)
app.include_router(
    stripe_webhook_router, prefix="/api/v1/webhooks", tags=["Stripe Webhooks"]
)


@app.get("/")
async def root():
    return {"message": "Welcome to LoreBridge API! Go to /docs for API documentation."}


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "lorebridge-api"}


@app.get("/healthz")
async def healthz():
    return JSONResponse({"status": "ok"})


@app.on_event("shutdown")
async def shutdown_event():
    print(f"LoreBridge Application '{settings.APP_NAME}' shutdown completed.")
    # Clean up agent resources if necessary (e.g., closing connections).
