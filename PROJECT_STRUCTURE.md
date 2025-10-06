# 🌉 LoreBridge - Project Structure & Architecture

## **📋 Project Overview**

**LoreBridge** is an AI-powered knowledge management and content processing platform that combines web scraping, document analysis, and intelligent agents. It provides a visual workflow interface for building AI-powered data pipelines.

### **🎯 Core Capabilities:**
- **AI Agent System** - Intelligent document processing and analysis
- **Web Content Extraction** - Clean web scraping via Firecrawl
- **PDF Processing** - Text extraction and analysis
- **Visual Workflow Builder** - Node-based interface for data pipelines
- **Browser Extension** - Web clipping and content capture
- **Authentication & Payments** - User management via Clerk + Stripe

---

## **🏗️ Architecture Overview**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   FRONTEND      │    │    BACKEND      │    │   SERVICES      │
│   (Next.js)     │◄──►│   (FastAPI)     │◄──►│   (External)    │
│                 │    │                 │    │                 │
│ • React 19      │    │ • Python 3.11+  │    │ • OpenAI API    │
│ • TypeScript    │    │ • LangChain     │    │ • Firecrawl     │
│ • Tailwind CSS  │    │ • PostgreSQL    │    │ • Stripe        │
│ • Radix UI      │    │ • ChromaDB      │    │ • Clerk Auth    │
│ • Clerk Auth    │    │ • SQLAlchemy    │    │                 │
│ • XYFlow        │    │ • Alembic       │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ BROWSER EXT     │    │   TRANSCRIPT    │    │   STORAGE       │
│ (Manifest V3)   │    │   SERVICE       │    │                 │
│                 │    │   (Python)      │    │ • Uploads/PDFs  │
│ • Web Clipper   │    │                 │    │ • Vector DB     │
│ • Content Script│    │ • Audio/Video   │    │ • PostgreSQL    │
│ • Background JS │    │ • Transcription │    │ • File Storage  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

---

## **📁 Directory Structure**

### **Root Level**
```
/lorebridge/
├── 📁 client/                    # Next.js Frontend Application
├── 📁 server/                    # FastAPI Backend Application  
├── 📁 extension/                 # Browser Extension (Manifest V3)
├── 📁 python-transcript-service/ # Audio/Video Transcription Service
├── 📄 docker-compose.yml         # Container orchestration
└── 📄 PROJECT_STRUCTURE.md       # This documentation file
```

---

## **🎨 Frontend (`/client/`) - Next.js Application**

### **Technology Stack:**
- **Framework:** Next.js 15.3.3 with React 19
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS 4 + Radix UI Components
- **Authentication:** Clerk (@clerk/nextjs)
- **Payments:** Stripe (@stripe/stripe-js)
- **State Management:** Zustand
- **Flow Builder:** XYFlow (@xyflow/react)
- **File Processing:** PDF.js (react-pdf), OpenAI integration

### **Directory Structure:**
```
/client/
├── 📁 app/                      # Next.js App Router
│   ├── 📄 layout.tsx           # Root layout with Clerk
│   ├── 📄 page.tsx             # Landing page
│   ├── 📁 dashboard/           # Protected dashboard routes
│   ├── 📁 api/                 # Next.js API routes
│   └── 📁 (auth)/              # Authentication pages
│
├── 📁 components/               # React Components
│   ├── 📁 ui/                  # Base UI components (Radix)
│   ├── 📁 flow/                # Flow builder components
│   │   ├── 📁 nodes/           # Custom node types
│   │   │   ├── 📄 WebsiteNode.tsx    # Web scraping nodes
│   │   │   ├── 📄 PDFNode.tsx        # PDF processing nodes
│   │   │   └── 📄 AgentNode.tsx      # AI agent nodes
│   │   ├── 📁 edges/           # Custom edge types
│   │   └── 📁 hooks/           # Flow management hooks
│   ├── 📁 dashboard/           # Dashboard-specific components
│   └── 📁 auth/                # Authentication components
│
├── 📁 lib/                     # Utility libraries
│   ├── 📄 api.ts               # API client functions
│   ├── 📄 auth.ts              # Clerk configuration
│   ├── 📄 utils.ts             # Utility functions
│   └── 📄 validations.ts       # Form validation schemas
│
├── 📁 types/                   # TypeScript type definitions
├── 📁 public/                  # Static assets
├── 📄 package.json             # Dependencies & scripts
├── 📄 tailwind.config.js       # Tailwind configuration
├── 📄 next.config.ts           # Next.js configuration
└── 📄 tsconfig.json            # TypeScript configuration
```

### **Key Frontend Features:**
- **Visual Flow Builder** - Drag-and-drop interface for creating data pipelines
- **Node Types:** Website scraping, PDF processing, AI agents, data transformations
- **Real-time Updates** - WebSocket connections for live status updates
- **File Upload** - Drag-and-drop PDF upload with progress tracking
- **Authentication** - Social login, user management via Clerk
- **Responsive Design** - Mobile-friendly interface

---

## **⚙️ Backend (`/server/`) - FastAPI Application**

### **Technology Stack:**
- **Framework:** FastAPI 0.115.12
- **Language:** Python 3.11+
- **Database:** PostgreSQL with SQLAlchemy 2.0
- **Migrations:** Alembic
- **AI/ML:** LangChain, OpenAI, LangGraph
- **Vector Database:** ChromaDB
- **Authentication:** FastAPI-Clerk-Auth
- **Web Scraping:** Firecrawl
- **PDF Processing:** PyMuPDF
- **Payments:** Stripe

### **Directory Structure:**
```
/server/
├── 📁 app/                     # Main application code
│   ├── 📄 __init__.py
│   ├── 📄 main.py              # FastAPI app entry point
│   │
│   ├── 📁 core/                # Core configuration
│   │   ├── 📄 config.py        # Environment settings
│   │   ├── 📄 security.py      # Security utilities
│   │   ├── 📄 logger.py        # Logging configuration  
│   │   └── 📄 dependencies.py  # Dependency injection
│   │
│   ├── 📁 api/                 # API layer
│   │   └── 📁 v1/              # API version 1
│   │       ├── 📄 __init__.py
│   │       └── 📁 endpoints/   # API endpoints
│   │           ├── 📄 auth.py        # Authentication routes
│   │           ├── 📄 nodes.py       # Node management
│   │           ├── 📄 agents.py      # AI agent routes
│   │           ├── 📄 uploads.py     # File upload handling
│   │           └── 📄 webhooks.py    # Stripe/Clerk webhooks
│   │
│   ├── 📁 models/              # Database models (SQLAlchemy)
│   │   ├── 📄 __init__.py
│   │   ├── 📄 user.py          # User model
│   │   ├── 📄 asset.py         # Asset/document model
│   │   ├── 📄 node.py          # Flow node model
│   │   └── 📄 agent.py         # AI agent model
│   │
│   ├── 📁 schemas/             # Pydantic schemas (API contracts)
│   │   ├── 📄 __init__.py
│   │   ├── 📄 user.py          # User schemas
│   │   ├── 📄 asset.py         # Asset schemas
│   │   ├── 📄 node.py          # Node schemas
│   │   └── 📄 common.py        # Common response schemas
│   │
│   ├── 📁 services/            # Business logic layer
│   │   ├── 📄 __init__.py
│   │   ├── 📄 firecrawl_service.py   # Web scraping service
│   │   ├── 📄 pdf_service.py         # PDF processing service
│   │   ├── 📄 ai_service.py          # AI/LLM service
│   │   ├── 📄 vector_service.py      # Vector database service
│   │   └── 📄 stripe_service.py      # Payment processing
│   │
│   ├── 📁 agents/              # AI Agent implementations
│   │   ├── 📄 __init__.py
│   │   ├── 📄 base_agent.py    # Base agent class
│   │   └── 📄 my_strand_agent.py # Custom agent implementation
│   │
│   ├── 📁 db/                  # Database layer
│   │   ├── 📄 __init__.py
│   │   ├── 📄 database.py      # Database connection
│   │   └── 📄 base.py          # Base model class
│   │
│   ├── 📁 alembic/             # Database migrations
│   │   ├── 📁 versions/        # Migration files
│   │   ├── 📄 env.py           # Alembic environment
│   │   └── 📄 script.py.mako   # Migration template
│   │
│   └── 📁 tests/               # Test suite
│       ├── 📄 __init__.py
│       ├── 📄 conftest.py      # Test configuration
│       └── 📄 test_agent_routes.py
│
├── 📁 uploads/                 # File storage
│   └── 📁 pdfs/                # PDF uploads
│
├── 📁 storage/                 # Additional storage
├── 📄 Dockerfile              # Container configuration
├── 📄 pyproject.toml           # Python project configuration
├── 📄 requirements.txt         # Python dependencies
└── 📄 alembic.ini              # Database migration config
```

### **Key Backend Features:**
- **RESTful API** - Clean API design with FastAPI
- **AI Agent System** - LangChain-based intelligent processing
- **Web Scraping** - Firecrawl integration for clean content extraction
- **PDF Processing** - Text extraction and chunking for RAG
- **Vector Search** - ChromaDB for similarity search
- **Authentication** - Clerk integration with FastAPI
- **Database Migrations** - Alembic for schema versioning
- **Background Processing** - Async task handling

---

## **🌐 Browser Extension (`/extension/`) - Manifest V3**

### **Purpose:** Web content capture and clipping tool

### **Files:**
```
/extension/
├── 📄 manifest.json            # Extension configuration
├── 📄 popup.html               # Extension popup UI
├── 📄 popup.js                 # Popup functionality
├── 📄 background.js            # Service worker
├── 📄 content.js               # Content script (page interaction)
├── 📄 chat-extractors.js       # Chat content extraction
├── 📄 welcome.html             # Welcome page
└── 📁 icons/                   # Extension icons
    └── 📄 icon.svg
```

### **Capabilities:**
- **Web Clipping** - Capture content from any website
- **Chat Extraction** - Extract conversations from messaging platforms
- **Screenshot Capture** - Visual content capture
- **Content Storage** - Send captured content to LoreBridge backend

---

## **🎙️ Transcript Service (`/python-transcript-service/`)**

### **Purpose:** Audio/video transcription processing

### **Technology:** Python-based transcription service
### **Integration:** Processes audio/video files for the main application

---

## **🗃️ Database Schema**

### **Core Tables:**
```sql
-- Users (managed by Clerk)
users
├── id (UUID, PK)
├── clerk_user_id (String, unique)
├── email (String)
├── created_at (Timestamp)
└── updated_at (Timestamp)

-- Assets (documents, websites, files)
assets  
├── id (UUID, PK)
├── user_id (UUID, FK)
├── name (String)
├── type (Enum: pdf, website, image)
├── file_path (String, nullable)
├── extracted_text (Text, nullable)        # Clean extracted content
├── summary (Text, nullable)               # Content summary
├── processing_metadata (JSON, nullable)   # Scraping metadata
├── status (Enum: processing, completed, failed)
├── created_at (Timestamp)
└── updated_at (Timestamp)

-- Nodes (flow builder elements)  
nodes
├── id (UUID, PK)
├── user_id (UUID, FK)
├── asset_id (UUID, FK, nullable)         # Linked asset
├── type (Enum: website, pdf, agent, transform)
├── position_x (Float)
├── position_y (Float)
├── config (JSON)                         # Node-specific settings
├── is_placeholder (Boolean, default: true)
├── created_at (Timestamp)
└── updated_at (Timestamp)

-- Agents (AI processing units)
agents
├── id (UUID, PK)
├── user_id (UUID, FK)
├── name (String)
├── type (String)
├── config (JSON)                         # Agent configuration
├── created_at (Timestamp)
└── updated_at (Timestamp)
```

---

## **🔄 Key Workflows**

### **1. Website Content Processing:**
```
1. User creates Website Node (placeholder)
2. User enters URL
3. Backend calls Firecrawl API
4. Clean markdown content extracted
5. Content stored in assets table
6. Frontend displays processed content
```

### **2. PDF Processing:**
```
1. User uploads PDF file
2. File stored in /uploads/pdfs/
3. PyMuPDF extracts text content
4. Text chunked for vector storage
5. Content available for AI processing
```

### **3. AI Agent Workflow:**
```
1. User configures AI Agent node
2. Agent processes input content
3. LangChain orchestrates AI operations
4. Results stored and displayed
5. Output available for next nodes
```

---

## **🚀 Development Commands**

### **Frontend (Next.js):**
```bash
cd client/
npm install                    # Install dependencies
npm run dev                    # Development server (localhost:3000)
npm run build                  # Production build
npm run start                  # Production server
npm run lint                   # Code linting
```

### **Backend (FastAPI):**
```bash
cd server/
pip install -e .               # Install in development mode
uvicorn app.main:app --reload  # Development server (localhost:8000)
alembic upgrade head           # Run database migrations
pytest                        # Run test suite
```

### **Database Migrations:**
```bash
cd server/
alembic revision --autogenerate -m "Description"  # Create migration
alembic upgrade head                               # Apply migrations
alembic downgrade -1                              # Rollback one migration
```

---

## **🔧 Configuration & Environment**

### **Required Environment Variables:**

#### **Frontend (`client/.env.local`):**
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_API_URL=https://your-api-domain.example.com
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
```

#### **Backend (`server/.env`):**
```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/lorebridge

# Authentication
CLERK_SECRET_KEY=sk_...
CLERK_JWT_VERIFICATION_KEY=...

# AI Services  
OPENAI_API_KEY=sk-...
FIRECRAWL_API_KEY=fc-...

# Payments
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Application
SECRET_KEY=your-secret-key
DEBUG=True
```

---

## **🔐 Security & Authentication**

### **Authentication Flow:**
1. **Clerk Frontend** - Handles user registration/login
2. **JWT Verification** - Backend validates Clerk JWTs
3. **User Context** - Each request includes authenticated user
4. **Resource Authorization** - Users can only access their own data

### **API Security:**
- **CORS Configuration** - Restricted to frontend domain
- **Rate Limiting** - API endpoint protection
- **Input Validation** - Pydantic schema validation
- **SQL Injection Prevention** - SQLAlchemy ORM protection

---

## **📊 Monitoring & Observability**

### **Logging:**
- **Structured Logging** - JSON format with correlation IDs
- **Error Tracking** - Comprehensive error capture
- **Performance Metrics** - Request timing and resource usage

### **Health Checks:**
- **API Health** - `/health` endpoint
- **Database Connectivity** - Connection pool monitoring
- **External Service Status** - OpenAI, Firecrawl, Stripe availability

---

## **🎯 Current Development Status**

### **✅ Completed Features:**
- ✅ Basic Next.js frontend with authentication
- ✅ FastAPI backend with database models
- ✅ Firecrawl web scraping integration
- ✅ PDF processing and text extraction
- ✅ AI agent framework with LangChain
- ✅ Browser extension for content capture
- ✅ Visual flow builder with custom nodes
- ✅ User authentication via Clerk
- ✅ File upload and storage system

### **🔄 In Progress:**
- 🔄 Debugging website node URL serialization
- 🔄 Vector database integration for RAG
- 🔄 Enhanced AI agent capabilities
- 🔄 Real-time collaboration features

### **📋 Planned Features:**
- 📋 Advanced workflow orchestration
- 📋 Multi-user collaboration
- 📋 API integrations (Zapier, Make.com)
- 📋 Advanced analytics and reporting
- 📋 Enterprise authentication (SSO)

---

## **🤝 Contributing Guidelines**

### **Code Style:**
- **Frontend:** ESLint + Prettier with Next.js config
- **Backend:** Black + Ruff with Python 3.11+ features
- **TypeScript:** Strict mode enabled
- **Python:** Type hints required

### **Commit Convention:**
```
feat: Add new website scraping capability
fix: Resolve UUID serialization in node routes  
docs: Update API documentation
refactor: Optimize database queries
test: Add integration tests for agents
```

### **Pull Request Process:**
1. Create feature branch from `main`
2. Implement changes with tests
3. Update documentation
4. Submit PR with clear description
5. Code review and approval required

---

## **📚 Additional Resources**

### **External Documentation:**
- [Next.js Documentation](https://nextjs.org/docs)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [LangChain Documentation](https://docs.langchain.com/)
- [Clerk Authentication](https://clerk.com/docs)
- [Firecrawl API](https://docs.firecrawl.dev/)

### **Project-Specific Docs:**
- `WEBSITE_NODE_FIRECRAWL_INTEGRATION_SUMMARY.md` - Detailed integration guide
- `client/README.md` - Frontend setup instructions
- `server/README.md` - Backend setup instructions

---

## **💡 Quick Tips for New Developers**

### **Getting Started:**
1. **Set up environment variables** in both client and server directories
2. **Start with the backend** - Run database migrations first
3. **Use the test endpoints** - `/health` and `/test-*` routes for debugging
4. **Check the logs** - Both frontend (browser console) and backend (terminal)
5. **Use the documentation** - This file and the integration summary

### **Common Issues:**
- **UUID Serialization** - Always convert UUIDs to strings in API responses
- **CORS Errors** - Check frontend URL is whitelisted in backend CORS config
- **Database Connection** - Ensure PostgreSQL is running and credentials are correct
- **Authentication** - Verify Clerk keys are set in both frontend and backend

### **Development Workflow:**
1. **Backend First** - Implement API endpoints with proper schemas
2. **Frontend Integration** - Connect UI components to backend APIs  
3. **Testing** - Use manual testing and automated tests
4. **Documentation** - Update this file when adding major features

---
### **Development Workflow:**
1. **Backend First** - Implement API endpoints with proper schemas
2. **Frontend Integration** - Connect UI components to backend APIs  
3. **Testing** - Use manual testing and automated tests
4. **Documentation** - Update this file when adding major features

---
### **Development Workflow:**
1. **Backend First** - Implement API endpoints with proper schemas
2. **Frontend Integration** - Connect UI components to backend APIs  
3. **Testing** - Use manual testing and automated tests
4. **Documentation** - Update this file when adding major features

---
### **Development Workflow:**
1. **Backend First** - Implement API endpoints with proper schemas
2. **Frontend Integration** - Connect UI components to backend APIs  
3. **Testing** - Use manual testing and automated tests
4. **Documentation** - Update this file when adding major features

---
### **Development Workflow:**
1. **Backend First** - Implement API endpoints with proper schemas
2. **Frontend Integration** - Connect UI components to backend APIs  
3. **Testing** - Use manual testing and automated tests
4. **Documentation** - Update this file when adding major features

---
ddddddddddddddgf
sdg
sdgdsg
*This documentation is living and should be updated as the project evolves. Last updated: [Current Date]* 
*This documentation is living and should be updated as the project evolves. Last updated: [Current Date]* 

*This documentation is living and should be updated as the project evolves. Last updated: [Current Date]* 

ddddddddddddddgf


ddddddddddddddgf

ddddddddddddddgf
ddddddddddddddgf
ddddddddddddddgf
ddddddddddddddgf
ddddddddddddddgf

ddddddddddddddgf

ddddddddddddddgf
ddddddddddddddgf
ddddddddddddddgf
ddddddddddddddgf
ddddddddddddddgf
ddddddddddddddgf

ddddddddddddddgf
ddddddddddddddgf
ddddddddddddddgf
ddddddddddddddgf
ddddddddddddddgf
ddddddddddddddgf

  ring:
    kvstore:
      store: inmemory

schema_config:
  configs:
    - from: 2024-01-01
      store: boltdb-shipper
      object_store: filesystem
      schema: v13
      index:
        prefix: index_
        period: 24h

storage_config:

repo = diff_data.repo or "Unknown"
        branch = diff_data.branch or "main"

        # Auto-cleanup: Mark old pending validations as rejected for the same repo/branch
        # This ensures only one active validation per repo/branch at a time
        logger.info(f"Checking for old pending validations for user {current_user.id}, repo={repo}, branch={branch}")

        old_pending = await db.execute(
            select(DiffValidation).where(
                DiffValidation.user_id == str(current_user.id),
                DiffValidation.repo == repo,
                DiffValidation.branch == branch,
                DiffValidation.status == DiffStatus.PENDING
            )