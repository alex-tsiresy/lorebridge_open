# LangChain Modular Architecture

This document describes the modular architecture for the LangChain chat functionality, which has been refactored from a monolithic endpoint into separate, focused services.

## Architecture Overview

The original `langchain_llm.py` file (510 lines) has been modularized into the following structure:

```
app/
├── schemas/
│   └── langchain.py                    # Request/response models
├── services/
│   ├── langchain_agent_service.py      # Agent creation and configuration
│   ├── context_formatter_service.py    # Context formatting and system prompts
│   ├── chat_persistence_service.py     # Database persistence
│   ├── streaming_service.py            # Streaming response handling
│   └── langchain_chat_service.py       # Main orchestration service
└── api/v1/endpoints/
    └── langchain_llm.py                # Clean, focused endpoint
```

## Service Responsibilities

### 1. LangChainAgentService (`langchain_agent_service.py`)
**Purpose**: Creates and configures LangChain agents with tools

**Key Responsibilities**:
- LLM initialization and configuration
- Tool creation (web search, dynamic tools)
- Agent creation with proper temperature settings
- Environment setup (API keys)

**Key Methods**:
- `create_agent()`: Main method to create a fully configured agent
- `_get_temperature()`: Determines appropriate temperature for different models
- `_create_llm()`: Creates and configures the LLM
- `_create_search_tool()`: Creates the web search tool

### 2. ContextFormatterService (`context_formatter_service.py`)
**Purpose**: Handles context formatting and system prompt generation

**Key Responsibilities**:
- System prompt generation
- Context data formatting (chat conversations, tables, documents)
- Message processing and context extraction
- Tool-specific guidance integration

**Key Methods**:
- `process_messages_and_context()`: Main method for processing messages
- `format_context_as_paragraph()`: Formats different types of context data
- `format_context_content()`: Formats content based on type (chat, transcript, PDF)
- `_get_default_system_prompt()`: Provides the default system prompt

### 3. ChatPersistenceService (`chat_persistence_service.py`)
**Purpose**: Handles database persistence for chat sessions and messages

**Key Responsibilities**:
- Chat session management
- User message persistence
- Assistant message persistence with tool outputs
- Database transaction handling

**Key Methods**:
- `ensure_chat_session()`: Creates or updates chat sessions
- `persist_user_message()`: Saves user messages
- `persist_assistant_message()`: Saves assistant messages with tool outputs
- `get_user_message_content()`: Extracts user message content

### 4. StreamingService (`streaming_service.py`)
**Purpose**: Handles streaming response processing and token serialization

**Key Responsibilities**:
- Token serialization for streaming
- Tool message processing
- Message format conversion
- Error response creation

**Key Methods**:
- `messages_to_langgraph_format()`: Converts messages to LangGraph format
- `serialize_token()`: Serializes streaming tokens
- `process_tool_message()`: Processes tool messages and extracts outputs
- `create_streaming_response()`: Creates streaming responses

### 5. LangChainChatService (`langchain_chat_service.py`)
**Purpose**: Main orchestration service that coordinates all other services

**Key Responsibilities**:
- Service coordination
- Session validation
- Stream creation and management
- Error handling and logging

**Key Methods**:
- `create_chat_stream()`: Main method that orchestrates the entire chat flow
- `validate_session_id()`: Validates and converts session IDs
- `_extract_message_chunk()`: Extracts message chunks from tokens

## Benefits of Modularization

### 1. **Separation of Concerns**
Each service has a single, well-defined responsibility, making the code easier to understand and maintain.

### 2. **Testability**
Individual services can be unit tested in isolation, improving test coverage and reliability.

### 3. **Reusability**
Services can be reused across different endpoints or parts of the application.

### 4. **Maintainability**
Changes to specific functionality (e.g., context formatting) only require changes to the relevant service.

### 5. **Readability**
The main endpoint is now clean and focused, making it easier to understand the high-level flow.

### 6. **Error Handling**
Each service can handle its own specific errors, providing better error isolation and debugging.

## Usage Example

```python
# Before (monolithic approach)
@router.post("/langchain-chat")
async def langchain_chat_endpoint(req, db, credentials):
    # 500+ lines of mixed concerns
    # LLM setup, tool creation, context formatting, 
    # persistence, streaming, error handling all mixed together
    pass

# After (modular approach)
@router.post("/langchain-chat")
async def langchain_chat_endpoint(req, db, credentials):
    """Clean, focused endpoint"""
    try:
        user_id = credentials.decoded["sub"]
        chat_service = LangChainChatService(db)
        
        async def event_stream():
            async for chunk in chat_service.create_chat_stream(
                session_id=req.session_id,
                user_id=user_id,
                messages=req.messages,
                model=req.model,
                temperature=req.temperature
            ):
                yield chunk
        
        return StreamingResponse(event_stream(), media_type="text/event-stream")
    except ValueError as e:
        # Handle validation errors
        pass
    except Exception as e:
        # Handle unexpected errors
        pass
```

## Migration Notes

The original `langchain_llm.py` file has been completely refactored to use the new modular services. The functionality remains exactly the same, but the code is now:

- **510 lines → ~50 lines** in the main endpoint
- **Better organized** with clear separation of concerns
- **More maintainable** with focused, testable services
- **More readable** with clear service boundaries

## Future Enhancements

With this modular architecture, future enhancements become much easier:

1. **New Context Types**: Add new formatting methods to `ContextFormatterService`
2. **New Tools**: Extend `LangChainAgentService` with new tool creation methods
3. **Different Persistence**: Swap out `ChatPersistenceService` for different storage backends
4. **Alternative Streaming**: Replace `StreamingService` with different streaming implementations
5. **Testing**: Add comprehensive unit tests for each service independently 