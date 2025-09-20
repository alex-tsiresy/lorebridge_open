# LoreBridge API

Welcome to the LoreBridge backend! This service powers the AI workflows, chat capabilities, file processing, and user management behind the LoreBridge platform.

## 🚀 **Quick Start**

### Local Development Setup

For faster development and debugging, you can run the server directly on your machine without Docker.

```bash
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Docker Setup

1.  **Navigate to the `server` directory:**
    ```bash
    cd server
    ```

2.  **Populate your `.env` file:**
    Copy the `.env.example` to `.env` and fill in your actual API keys and sensitive information. **Do NOT commit `.env` to version control!**
    ```bash
    cp .env.example .env
    # Now, open '.env' and add your values (e.g., OPENAI_API_KEY)
    ```

3.  **Build and run the Docker containers:**
    ```bash
    docker compose up --build -d
    ```
    This command will:
    * Build the Docker image for your FastAPI application.
    * Start the `web` service (your FastAPI app) in detached mode.
    * Map port `8000` from the container to your host machine.

## 🌐 **Accessing the API**

Once the containers are up and running, you can access:
* **FastAPI Application:** `http://localhost:8000`
* **Interactive API Docs (Swagger UI):** `http://localhost:8000/docs`
* **Alternative Docs (Redoc):** `http://localhost:8000/redoc`

## 🔧 **Code Quality & Development Tools**

LoreBridge maintains high code quality through automated tools and best practices. We've implemented a comprehensive development workflow to ensure modularity, readability, and maintainability.

### Development Tools

We provide a convenient development tools script that automates code quality checks:

```bash
# Quick quality check
uv run python scripts/dev_tools.py check

# Auto-fix style issues
uv run python scripts/dev_tools.py fix

# Analyze code complexity
uv run python scripts/dev_tools.py complexity

# Run tests with coverage
uv run python scripts/dev_tools.py test

# Clean project artifacts
uv run python scripts/dev_tools.py clean

# Generate comprehensive report
uv run python scripts/dev_tools.py report

# Run all checks together
uv run python scripts/dev_tools.py all
```

## 🏗️ **Architecture & Modularity**

LoreBridge follows a **layered architecture** with clear separation of concerns and organized service boundaries:

### Service Organization

Services are organized by **domain responsibility** for better modularity:

```
app/services/
├── ai/                    # 🤖 AI & Machine Learning Services
│   ├── llm_manager.py            # LLM provider management
│   ├── summarization_service.py  # Text summarization
│   └── paraphrasing_service.py   # Text paraphrasing
├── payment/               # 💳 Payment & Billing Services
│   └── stripe_service.py         # Stripe payment processing
├── export/                # 📤 Data Export Services
│   ├── md_export_service.py      # Markdown export
│   └── table_export_service.py   # Table/CSV export
├── content/               # 🌐 Web Content & Scraping
│   └── firecrawl_service.py      # Clean web content extraction
├── rag_services/          # 🧠 RAG (Retrieval-Augmented Generation)
│   ├── pdf_processing_service.py # PDF text extraction
│   ├── embedding_service.py      # Text embeddings
│   ├── vector_database_service.py # Vector database operations
│   └── rag_service.py            # Main RAG orchestration
└── langchain_services/    # 🔗 LangChain Integration
    ├── chat_service.py           # Conversational AI
    ├── streaming_service.py      # Real-time responses
    └── agent_service.py          # AI agents with tools
```

### Key Design Patterns

1. **Factory Pattern**: Used in node content creation for better extensibility
2. **Service Interfaces**: Clear contracts for service implementations
3. **Dependency Injection**: Centralized service management
4. **Structured Logging**: Secure and searchable logging practices
5. **Custom Exceptions**: Comprehensive error handling with context


## 🛠️ **Stopping the Application**

To stop the Docker containers:
```bash
docker compose down
```

To stop and remove all associated data:
```bash
docker compose down -v
```

## 📁 **Project Structure**

```
server/
├── app/                           # Main application code
│   ├── main.py                    # FastAPI app entry point
│   ├── core/                      # Core configuration & utilities
│   │   ├── config.py              # Environment settings (new modular structure)
│   │   ├── dependencies.py       # Dependency injection
│   │   ├── exceptions.py          # Custom exception classes
│   │   └── logger.py              # Logging configuration
│   ├── api/v1/endpoints/          # API route handlers
│   │   ├── user_routes.py         # User management
│   │   ├── asset_routes.py        # File/document handling
│   │   ├── node_routes.py         # Flow builder nodes (refactored)
│   │   └── chat_routes.py         # Chat functionality
│   ├── services/                  # 🎯 ORGANIZED BUSINESS LOGIC
│   │   ├── interfaces.py          # Service interface contracts
│   │   ├── dependencies.py       # Service dependency injection
│   │   ├── ai/                    # AI & ML services
│   │   ├── payment/               # Payment processing
│   │   ├── export/                # Data export services
│   │   ├── content/               # Web scraping
│   │   ├── rag_services/          # RAG implementation
│   │   └── langchain_services/    # LangChain integration
│   ├── db/                        # Database layer
│   │   ├── database.py            # Connection management
│   │   └── models/                # SQLAlchemy models
│   ├── schemas/                   # Pydantic schemas (API contracts)
│   └── tests/                     # Test suite
├── scripts/                       # Development utilities
│   └── dev_tools.py               # Code quality automation
├── pyproject.toml                 # Project configuration & dependencies
├── CODE_QUALITY_ACTION_PLAN.md    # Improvement roadmap
├── .env.example                   # Example environment variables
├── docker-compose.yml             # Container orchestration
└── README.md                      # This file
```
