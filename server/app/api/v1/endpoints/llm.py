import asyncio
import json

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.auth_decorators import require_auth
from app.core.logger import logger
from app.core.rate_limiter import limiter, CHAT_RATE_LIMIT
from app.db.session import get_db
from app.models.user import User as DBUser
from app.services.ai.llm_manager import LLMManager, get_llm_manager

router = APIRouter()

# Authentication handled by centralized auth module


class ChatReq(BaseModel):
    session_id: str = Field(...)
    user_id: str = Field(...)
    messages: list = Field(...)
    model: str = Field(default=None)
    previous_response_id: str = Field(default=None)  # For multi-turn conversations
    tools: list = Field(default=[])  # Add tools parameter


def serialize(obj):
    # Handle None
    if obj is None:
        return None
    # Handle Pydantic v2+ models
    if hasattr(obj, "model_dump"):
        try:
            return obj.model_dump(by_alias=True, exclude_unset=True)
        except Exception:
            try:
                return obj.model_dump()
            except Exception:
                return str(obj)
    # Handle Pydantic v1 models
    elif hasattr(obj, "dict"):
        try:
            return obj.dict()
        except Exception:
            return str(obj)
    # Handle dataclasses
    elif hasattr(obj, "__dataclass_fields__"):
        try:
            from dataclasses import asdict

            return asdict(obj)
        except Exception:
            return str(obj)
    # Handle objects with to_dict
    elif hasattr(obj, "to_dict"):
        try:
            return obj.to_dict()
        except Exception:
            return str(obj)
    # Handle __dict__ for generic objects, skip private fields
    elif hasattr(obj, "__dict__"):
        result = {}
        for k, v in obj.__dict__.items():
            if not k.startswith("_"):
                try:
                    result[k] = serialize(v)
                except Exception:
                    result[k] = str(v)
        return result
    # Handle lists and tuples
    elif isinstance(obj, list | tuple):
        return [serialize(i) for i in obj]
    # Handle dicts
    elif isinstance(obj, dict):
        return {k: serialize(v) for k, v in obj.items()}
    # Fallback: try to convert to string
    else:
        try:
            return str(obj)
        except Exception:
            return None


@router.post("/chat")
@limiter.limit(CHAT_RATE_LIMIT)
async def chat_endpoint(
    request: Request,
    req: ChatReq,
    llm_manager: LLMManager = Depends(get_llm_manager),
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(require_auth()),
):
    # SECURITY: Ensure the request user_id matches the authenticated user
    if req.user_id != current_user.clerk_user_id:
        raise HTTPException(
            status_code=403, 
            detail="Not authorized to create messages for this user ID"
        )
    
    # Start async persistence of user messages (non-blocking)
    from app.services.async_db_service import async_db_service
    asyncio.create_task(
        async_db_service.persist_user_messages_async(
            req.session_id, 
            req.user_id, 
            req.messages, 
            req.model or "gpt-4o"
        )
    )

    # Prepare input for OpenAI Responses API
    formatted_messages = []
    for msg in req.messages:
        if msg["role"] == "user":
            formatted_messages.append(
                {
                    "role": "user",
                    "content": [{"type": "input_text", "text": msg["content"]}],
                }
            )
        elif msg["role"] == "assistant":
            formatted_messages.append(
                {
                    "role": "assistant",
                    "content": [{"type": "output_text", "text": msg["content"]}],
                }
            )
        elif msg["role"] == "system":
            formatted_messages.append(
                {
                    "role": "developer",
                    "content": [{"type": "input_text", "text": msg["content"]}],
                }
            )

    # Use gpt-4.1 as the default model if not specified
    model_to_use = req.model or "gpt-4.1"

    def event_stream():
        last_event = None
        last_event_dict = None
        collected_tool_steps = []  # Collect tool outputs for this response
        try:
            for event in llm_manager.chat_stream(
                input=formatted_messages,
                model=model_to_use,
                tools=req.tools,  # Pass tools to the LLM manager
                previous_response_id=(
                    req.previous_response_id if req.previous_response_id else None
                ),
            ):
                try:
                    event_dict = serialize(event)
                    # Robustly collect tool output steps for web_search_call
                    if (
                        isinstance(event_dict, dict)
                        and event_dict.get("type") == "response.output_item.done"
                    ):
                        item = event_dict.get("item")
                        if (
                            isinstance(item, dict)
                            and item.get("type") == "web_search_call"
                        ):
                            action = item.get("action")
                            if (
                                isinstance(action, dict)
                                and action.get("type") == "search"
                            ):
                                tool_info = {
                                    "type": "web_search_call",
                                    "query": action.get("query"),
                                    "status": item.get("status", "completed"),
                                }
                                # Add url, title, snippet if present
                                if "url" in action:
                                    tool_info["url"] = action["url"]
                                if "title" in action:
                                    tool_info["title"] = action["title"]
                                if "snippet" in action:
                                    tool_info["snippet"] = action["snippet"]
                                # Add results array if present
                                if "results" in action and isinstance(
                                    action["results"], list
                                ):
                                    tool_info["results"] = [
                                        {
                                            "title": r.get("title"),
                                            "url": r.get("url"),
                                            "snippet": r.get("snippet"),
                                        }
                                        for r in action["results"]
                                    ]
                                collected_tool_steps.append(tool_info)
                                logger.info(
                                    f"Collected web search tool step: {json.dumps(tool_info, ensure_ascii=False)}"
                                )
                    # Buffer response.completed event, stream all others
                    if (
                        isinstance(event_dict, dict)
                        and event_dict.get("type") == "response.completed"
                    ):
                        last_event = event
                        last_event_dict = event_dict
                        # Do not yield yet
                    else:
                        yield json.dumps(event_dict) + "\n"
                except Exception as ser_exc:
                    logger.error(
                        f"Serialization error: {ser_exc}\nEvent: {event!r} (type: {type(event)})",
                        exc_info=True,
                    )
                    yield (
                        json.dumps(
                            {
                                "type": "error",
                                "error": f"Serialization error: {ser_exc!s}",
                            }
                        )
                        + "\n"
                    )
                    continue

            # After streaming, send the single, final response.completed event
            if (
                isinstance(last_event_dict, dict)
                and last_event_dict.get("type") == "response.completed"
            ):
                # Augment the last response.completed event
                final_response_event = dict(last_event_dict)  # shallow copy
                if "output" not in final_response_event or not isinstance(
                    final_response_event["output"], list
                ):
                    final_response_event["output"] = []
                if collected_tool_steps:
                    logger.info(
                        f"Sending aggregated web search tool steps: {json.dumps(collected_tool_steps, ensure_ascii=False)}"
                    )
                    final_response_event["output"].append(
                        {
                            "type": "aggregated_tool_outputs",
                            "tool_steps": collected_tool_steps,
                            "id": f"tool_output_agg_{req.session_id}",
                        }
                    )
                yield json.dumps(final_response_event) + "\n"
                logger.info(
                    f"Sent final response.completed with aggregated tool outputs: {collected_tool_steps}"
                )
            else:
                # Fallback: construct a new response.completed event if needed
                final_response_event = {"type": "response.completed", "output": []}
                if collected_tool_steps:
                    logger.info(
                        f"Sending fallback aggregated web search tool steps: {json.dumps(collected_tool_steps, ensure_ascii=False)}"
                    )
                    final_response_event["output"].append(
                        {
                            "type": "aggregated_tool_outputs",
                            "tool_steps": collected_tool_steps,
                            "id": f"tool_output_agg_{req.session_id}",
                        }
                    )
                yield json.dumps(final_response_event) + "\n"
                logger.info(
                    f"Sent fallback response.completed with aggregated tool outputs: {collected_tool_steps}"
                )
        except Exception as e:
            import traceback

            logger.error(
                f"Exception in event_stream: {e}\nLast event: {last_event!r} (type: {type(last_event)})\n{traceback.format_exc()}"
            )
            yield json.dumps({"type": "error", "error": str(e)}) + "\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
