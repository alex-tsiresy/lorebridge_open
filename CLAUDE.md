# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Client (Next.js Frontend)
```bash
cd client
npm run dev          # Start development server with Turbopack
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

### Server (FastAPI Backend)
```bash
cd server
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000  # Local development
uv run python scripts/dev_tools.py check     # Run code quality checks
uv run python scripts/dev_tools.py fix       # Auto-fix style issues
uv run python scripts/dev_tools.py test      # Run tests with coverage
uv run pytest app/tests/                     # Run tests only
```

### Python Transcript Service
```bash
cd python-transcript-service
python app.py        # Start Flask development server
```

### Docker Development
```bash
docker compose up --build -d     # Start all services
docker compose down              # Stop all services
docker compose logs web          # View backend logs
```

## Project Architecture

### High-Level Structure
LoreBridge is a full-stack AI-powered platform with three main services:
- **Client**: Next.js 15 frontend with React Flow-based visual workspace
- **Server**: FastAPI backend with AI agents, RAG services, and database management
- **Python Transcript Service**: Flask service for YouTube/Instagram transcript processing

### Client Architecture (Next.js)
- **Framework**: Next.js 15 with App Router, React 19, TypeScript
- **Styling**: Tailwind CSS 4 with Radix UI components
- **Authentication**: Clerk integration with user sync to backend
- **Key Features**:
  - Visual flow-based workspace using React Flow (`components/flow/`)
  - Real-time chat with AI agents
  - PDF viewer with annotations
  - Subscription management with Stripe

### Server Architecture (FastAPI)
- **Framework**: FastAPI with SQLAlchemy ORM, PostgreSQL database
- **AI Integration**: OpenAI GPT models, LangChain for agent workflows
- **Service Architecture**: Domain-driven design with clear service boundaries
  - `ai/`: LLM management, summarization, paraphrasing
  - `assets/`: File processing (PDF, media, websites)
  - `rag_services/`: Vector database, embeddings, document search
  - `langchain_services/`: Chat, streaming, agent orchestration
  - `payment/`: Stripe integration
  - `export/`: Markdown and table export services

### Database Models
- **Users**: Clerk integration with subscription tracking
- **Graphs**: Visual workspace containers with nodes and edges
- **Assets**: Files, documents, media with vector database integration
- **Chat Sessions**: Persistent conversation history

### Key Technologies
- **Vector Database**: ChromaDB for embeddings and semantic search
- **File Processing**: PyMuPDF for PDFs, Firecrawl for web content
- **Authentication**: Clerk with JWT token validation
- **Payment**: Stripe subscriptions with webhook handling

## Development Guidelines

### Code Quality Standards
The server uses comprehensive code quality tools configured in `pyproject.toml`:
- **Ruff**: Linting and formatting (already passing)
- **MyPy**: Type checking (460 errors to fix - see CODE_QUALITY_ACTION_PLAN.md)
- **Bandit**: Security scanning
- **Pytest**: Testing with coverage reporting

### Testing Strategy
- Unit tests in `app/tests/`
- Integration tests for API endpoints
- Use `uv run pytest` for test execution
- Maintain test coverage above 80%

### Type Safety
- Server codebase is transitioning to full type annotations
- Priority files for type fixes: `llm_manager.py`, `dependencies.py`, API routes
- Client uses strict TypeScript configuration

### Error Handling
- Custom exception classes in `app/core/exceptions.py`
- Structured logging with security considerations
- Consistent API error responses

## Flow Component System

The visual workspace uses a modular React Flow architecture:
- **Node Types**: Chat, PDF, Document, Website, YouTube, Instagram, Table, Graph, Artefact
- **Extensibility**: Easy to add new node types following the factory pattern
- **State Management**: Centralized in `useFlowManager` hook
- **Full-Screen Modes**: Each node type supports full-screen viewing

## AI Agent Integration

### LangChain Agent System
- **Agent Types**: MyStrandAgent with tool integration
- **Tools**: PDF QA, web search, document processing
- **Streaming**: Real-time response streaming to frontend
- **Context Management**: Conversation persistence and context transfer

### RAG Implementation
- **Document Processing**: Chunking, embedding, vector storage
- **Retrieval**: Semantic search with relevance scoring
- **Generation**: Context-aware response generation

## Environment Configuration

### Required Environment Variables
**Server (.env)**:
- `DATABASE_URL`: PostgreSQL connection string
- `OPENAI_API_KEY`: OpenAI API access
- `CLERK_SECRET_KEY`: Authentication
- `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET`: Payment processing
- `FIRECRAWL_API_KEY`: Web scraping

**Client (.env.local)**:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: Client-side auth
- `CLERK_SECRET_KEY`: Server-side auth
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: Payment frontend

### Development Setup
1. Copy `.env.example` files and populate with actual values
2. Set up PostgreSQL database
3. Run Alembic migrations: `uv run alembic upgrade head`
4. Start services in order: database, server, client

## Deployment

### Docker Production
- Multi-service Docker Compose configuration
- Health checks for all services
- Volume persistence for database and uploads
- Nginx proxy support ready

### Service Ports
- Client: 3000
- Server: 8000
- Python Transcript Service: 5001
- PostgreSQL: 5432
- PgAdmin: 5050

## Performance Considerations

### Frontend Optimizations
- React Flow performance optimizations in place
- Virtualized content rendering for large documents
- Lazy loading for node content

### Backend Optimizations
- Database query optimization with proper indexing
- Vector database performance tuning
- Async processing for file uploads
- Connection pooling and query optimization

### Monitoring
- Structured logging throughout the application
- Performance monitoring hooks available
- Database query logging enabled in development
