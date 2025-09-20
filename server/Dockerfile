# syntax=docker/dockerfile:1

FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_NO_CACHE=1

# Install runtime tools (curl required by docker-compose healthcheck, patch for applying library fixes)
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl patch \
    && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

WORKDIR /app

# Install Python dependencies first for better layer caching
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-cache

# Apply patches for third-party library compatibility issues
COPY patches/ ./patches/
RUN chmod +x ./patches/apply_firecrawl_fix.sh && \
    ./patches/apply_firecrawl_fix.sh

# Copy Alembic configuration
COPY alembic.ini ./

# Copy application source
COPY app ./app

EXPOSE 8000

# Default command (docker-compose overrides with --reload for dev)
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]







