"""
Async database service for non-blocking database operations during streaming.

This service handles database operations that should not block streaming responses,
using background tasks and connection pooling optimizations with production-grade
error handling, timeouts, and graceful degradation.
"""
import asyncio
import uuid
import time
from typing import Any, Optional
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError

from sqlalchemy.exc import (
    DisconnectionError, 
    TimeoutError as SQLTimeoutError,
    StatementError,
    OperationalError
)

from app.core.logger import logger
from app.db.database import SessionLocal
from app.db.models.chat_message import ChatMessage
from app.db.models.chat_session import ChatSession
from app.db.models.llm_message import LLMMessage, RoleEnum
from app.db.models.artefact import Artefact


class AsyncDatabaseService:
    """Service for handling database operations asynchronously to prevent blocking."""
    
    def __init__(self, max_workers: int = 5, operation_timeout: float = 30.0):
        """
        Initialize with thread pool for async database operations.
        
        Args:
            max_workers: Maximum number of worker threads
            operation_timeout: Timeout for database operations in seconds
        """
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        self.operation_timeout = operation_timeout
        self.failure_count = 0
        self.circuit_breaker_threshold = 10  # Number of failures before circuit breaker opens
        self.circuit_breaker_open = False
        self.circuit_breaker_reset_time = None
    
    def _check_circuit_breaker(self) -> bool:
        """Check if circuit breaker should prevent operations."""
        if not self.circuit_breaker_open:
            return True
            
        # Check if enough time has passed to reset circuit breaker
        if (self.circuit_breaker_reset_time and 
            time.time() - self.circuit_breaker_reset_time > 60):  # 1 minute reset
            self.circuit_breaker_open = False
            self.failure_count = 0
            self.circuit_breaker_reset_time = None
            logger.info("Circuit breaker reset - allowing database operations")
            return True
            
        return False
    
    def _handle_operation_failure(self, operation_name: str, error: Exception):
        """Handle operation failure and update circuit breaker state."""
        self.failure_count += 1
        
        if self.failure_count >= self.circuit_breaker_threshold:
            self.circuit_breaker_open = True
            self.circuit_breaker_reset_time = time.time()
            logger.error(
                f"Circuit breaker opened after {self.failure_count} failures in {operation_name}",
                exc_info=True
            )
        
        logger.error(f"Async database operation failed: {operation_name} - {error}", exc_info=True)
    
    def _handle_operation_success(self):
        """Handle successful operation."""
        if self.failure_count > 0:
            self.failure_count = max(0, self.failure_count - 1)  # Gradual recovery
    
    async def _execute_with_timeout(self, func, *args, **kwargs):
        """Execute database operation with timeout and circuit breaker."""
        if not self._check_circuit_breaker():
            logger.warning("Circuit breaker open - skipping database operation")
            return False
            
        try:
            loop = asyncio.get_event_loop()
            result = await asyncio.wait_for(
                loop.run_in_executor(self.executor, func, *args, **kwargs),
                timeout=self.operation_timeout
            )
            self._handle_operation_success()
            return result
        except asyncio.TimeoutError:
            self._handle_operation_failure("timeout", TimeoutError("Database operation timed out"))
            return False
        except Exception as e:
            self._handle_operation_failure("execution", e)
            return False
    
    async def persist_user_messages_async(
        self, 
        session_id: str, 
        user_id: str, 
        messages: list[dict], 
        model: str
    ) -> bool:
        """Persist user messages asynchronously without blocking streaming."""
        return await self._execute_with_timeout(
            self._persist_user_messages_sync, 
            session_id, user_id, messages, model
        )
    
    def _persist_user_messages_sync(
        self, 
        session_id: str, 
        user_id: str, 
        messages: list[dict], 
        model: str
    ) -> bool:
        """Synchronous implementation for thread executor."""
        try:
            with SessionLocal() as db:
                # Persist user messages
                for msg in messages:
                    if msg["role"] == "user":
                        db_msg = LLMMessage(
                            session_id=session_id,
                            user_id=user_id,
                            role=RoleEnum.USER,
                            content=msg["content"],
                            model=model,
                            is_request=True,
                        )
                        db.add(db_msg)
                db.commit()
                return True
        except (OperationalError, DisconnectionError, SQLTimeoutError) as e:
            logger.error(f"Database connection error in persist_user_messages: {e}", exc_info=True)
            return False
        except Exception as e:
            logger.error(f"Failed to persist user messages: {e}", exc_info=True)
            return False
    
    async def ensure_chat_session_async(
        self, 
        session_uuid: uuid.UUID, 
        model: str
    ) -> bool:
        """Ensure chat session exists asynchronously."""
        return await self._execute_with_timeout(
            self._ensure_chat_session_sync, 
            session_uuid, model
        )
    
    def _ensure_chat_session_sync(self, session_uuid: uuid.UUID, model: str) -> bool:
        """Synchronous implementation for thread executor."""
        try:
            with SessionLocal() as db:
                chat_session = (
                    db.query(ChatSession)
                    .filter(ChatSession.id == session_uuid)
                    .first()
                )
                if not chat_session:
                    chat_session = ChatSession(id=session_uuid, model_used=model)
                    db.add(chat_session)
                else:
                    chat_session.model_used = model
                db.commit()
                return True
        except (OperationalError, DisconnectionError, SQLTimeoutError) as e:
            logger.error(f"Database connection error in ensure_chat_session: {e}", exc_info=True)
            return False
        except Exception as e:
            logger.error(f"Failed to ensure chat session: {e}", exc_info=True)
            return False
    
    async def persist_chat_message_async(
        self, 
        session_uuid: uuid.UUID, 
        role: str, 
        content: str, 
        tool_outputs: Optional[list[dict[str, Any]]] = None
    ) -> bool:
        """Persist chat message asynchronously."""
        return await self._execute_with_timeout(
            self._persist_chat_message_sync, 
            session_uuid, role, content, tool_outputs
        )
    
    def _persist_chat_message_sync(
        self, 
        session_uuid: uuid.UUID, 
        role: str, 
        content: str, 
        tool_outputs: Optional[list[dict[str, Any]]] = None
    ) -> bool:
        """Synchronous implementation for thread executor."""
        try:
            with SessionLocal() as db:
                chat_message = ChatMessage(
                    chat_session_id=session_uuid,
                    role=role,
                    content=content,
                    tool_output=tool_outputs if tool_outputs else None,
                )
                db.add(chat_message)
                db.commit()
                return True
        except (OperationalError, DisconnectionError, SQLTimeoutError) as e:
            logger.error(f"Database connection error in persist_chat_message: {e}", exc_info=True)
            return False
        except Exception as e:
            logger.error(f"Failed to persist chat message: {e}", exc_info=True)
            return False
    
    async def update_artefact_async(
        self, 
        artefact_id: str, 
        updates: dict[str, Any]
    ) -> bool:
        """Update artefact asynchronously."""
        return await self._execute_with_timeout(
            self._update_artefact_sync, 
            artefact_id, updates
        )
    
    def _update_artefact_sync(self, artefact_id: str, updates: dict[str, Any]) -> bool:
        """Synchronous implementation for thread executor."""
        try:
            with SessionLocal() as db:
                artefact = db.query(Artefact).filter(Artefact.id == artefact_id).first()
                if artefact:
                    for key, value in updates.items():
                        if hasattr(artefact, key):
                            setattr(artefact, key, value)
                    db.commit()
                    return True
                return False
        except (OperationalError, DisconnectionError, SQLTimeoutError) as e:
            logger.error(f"Database connection error in update_artefact: {e}", exc_info=True)
            return False
        except Exception as e:
            logger.error(f"Failed to update artefact: {e}", exc_info=True)
            return False
    
    def get_health_status(self) -> dict[str, Any]:
        """Get health status of the async database service."""
        return {
            "circuit_breaker_open": self.circuit_breaker_open,
            "failure_count": self.failure_count,
            "circuit_breaker_threshold": self.circuit_breaker_threshold,
            "operation_timeout": self.operation_timeout,
            "reset_time_remaining": (
                max(0, 60 - (time.time() - self.circuit_breaker_reset_time)) 
                if self.circuit_breaker_reset_time else 0
            )
        }
    
    async def create_user_async(
        self, 
        clerk_user_id: str,
        subscription_status: str = "free",
        subscription_cancel_at_period_end: bool = False,
        has_used_trial: bool = False
    ) -> bool:
        """Create user asynchronously."""
        return await self._execute_with_timeout(
            self._create_user_sync, 
            clerk_user_id, subscription_status, subscription_cancel_at_period_end, has_used_trial
        )
    
    def _create_user_sync(
        self, 
        clerk_user_id: str,
        subscription_status: str,
        subscription_cancel_at_period_end: bool,
        has_used_trial: bool
    ) -> bool:
        """Synchronous implementation for thread executor."""
        try:
            from app.models.user import User as DBUser
            with SessionLocal() as db:
                # Check if user already exists
                existing_user = db.query(DBUser).filter(DBUser.clerk_user_id == clerk_user_id).first()
                if existing_user:
                    return False  # User already exists
                
                # Create new user
                db_user = DBUser(
                    clerk_user_id=clerk_user_id,
                    subscription_status=subscription_status,
                    subscription_cancel_at_period_end=subscription_cancel_at_period_end,
                    has_used_trial=has_used_trial,
                )
                db.add(db_user)
                db.commit()
                return True
        except (OperationalError, DisconnectionError, SQLTimeoutError) as e:
            logger.error(f"Database connection error in create_user: {e}", exc_info=True)
            return False
        except Exception as e:
            logger.error(f"Failed to create user: {e}", exc_info=True)
            return False

    async def update_user_async(
        self,
        clerk_user_id: str,
        updates: dict[str, Any]
    ) -> bool:
        """Update user asynchronously."""
        return await self._execute_with_timeout(
            self._update_user_sync,
            clerk_user_id, updates
        )
    
    def _update_user_sync(self, clerk_user_id: str, updates: dict[str, Any]) -> bool:
        """Synchronous implementation for thread executor."""
        try:
            from app.models.user import User as DBUser
            with SessionLocal() as db:
                user = db.query(DBUser).filter(DBUser.clerk_user_id == clerk_user_id).first()
                if user:
                    for key, value in updates.items():
                        if hasattr(user, key):
                            setattr(user, key, value)
                    db.commit()
                    return True
                return False
        except (OperationalError, DisconnectionError, SQLTimeoutError) as e:
            logger.error(f"Database connection error in update_user: {e}", exc_info=True)
            return False
        except Exception as e:
            logger.error(f"Failed to update user: {e}", exc_info=True)
            return False

    async def create_graph_async(
        self,
        user_id: str,
        name: str,
        emoji: str = None,
        description: str = None,
        colors: list = None
    ) -> dict[str, Any] | None:
        """Create graph asynchronously."""
        return await self._execute_with_timeout(
            self._create_graph_sync,
            user_id, name, emoji, description, colors
        )
    
    def _create_graph_sync(
        self, 
        user_id: str,
        name: str,
        emoji: str,
        description: str,
        colors: list
    ) -> dict[str, Any] | None:
        """Synchronous implementation for thread executor."""
        try:
            from app.db.models.graph import Graph
            with SessionLocal() as db:
                db_graph = Graph(
                    user_id=user_id,
                    name=name,
                    emoji=emoji,
                    description=description,
                    colors=colors,
                )
                db.add(db_graph)
                db.commit()
                db.refresh(db_graph)
                return {
                    "id": str(db_graph.id),
                    "user_id": str(db_graph.user_id),
                    "name": db_graph.name,
                    "emoji": db_graph.emoji,
                    "description": db_graph.description,
                    "colors": db_graph.colors,
                    "created_at": db_graph.created_at.isoformat() if db_graph.created_at else None,
                    "last_accessed_at": db_graph.last_accessed_at.isoformat() if db_graph.last_accessed_at else None,
                    "favorite": db_graph.favorite
                }
        except (OperationalError, DisconnectionError, SQLTimeoutError) as e:
            logger.error(f"Database connection error in create_graph: {e}", exc_info=True)
            return None
        except Exception as e:
            logger.error(f"Failed to create graph: {e}", exc_info=True)
            return None

    def cleanup(self):
        """Cleanup thread pool executor."""
        self.executor.shutdown(wait=True)


# Global instance for dependency injection
async_db_service = AsyncDatabaseService()
