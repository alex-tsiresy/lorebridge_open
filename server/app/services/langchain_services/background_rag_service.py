"""
Background RAG Service for handling heavy PDF operations asynchronously.

This service processes heavy RAG operations in the background while providing
immediate streaming responses to the frontend.
"""

import asyncio
import json
import time
from typing import Any, Dict, List, Optional
from collections.abc import AsyncGenerator
from uuid import uuid4

from sqlalchemy.orm import Session

from app.core.logger import logger
from app.services.rag_services.pdf_qa_service import PDFQAService


class BackgroundRAGQueue:
    """Queue for managing background RAG operations"""
    
    def __init__(self):
        self.queues: Dict[str, asyncio.Queue] = {}
        self.results: Dict[str, Dict[str, Any]] = {}
        
    async def create_queue(self, session_id: str) -> str:
        """Create a new queue for a session"""
        queue_id = f"{session_id}_{uuid4().hex[:8]}"
        self.queues[queue_id] = asyncio.Queue()
        self.results[queue_id] = {}
        logger.info(f"Created background RAG queue: {queue_id}")
        return queue_id
        
    async def put_result(self, queue_id: str, result: Dict[str, Any]):
        """Put a result in the queue"""
        if queue_id in self.queues:
            await self.queues[queue_id].put(result)
            self.results[queue_id] = result
            
    async def get_result(self, queue_id: str, timeout: float = 0.1) -> Optional[Dict[str, Any]]:
        """Get a result from the queue with timeout"""
        if queue_id not in self.queues:
            return None
            
        try:
            result = await asyncio.wait_for(
                self.queues[queue_id].get(),
                timeout=timeout
            )
            return result
        except asyncio.TimeoutError:
            return None
            
    def cleanup_queue(self, queue_id: str):
        """Clean up resources for a completed queue"""
        if queue_id in self.queues:
            del self.queues[queue_id]
        if queue_id in self.results:
            del self.results[queue_id]


class BackgroundRAGService:
    """Service for handling PDF RAG operations in the background"""
    
    def __init__(self):
        self.queue_manager = BackgroundRAGQueue()
        self.pdf_qa_service = PDFQAService()
        
    async def process_pdf_question_background(
        self,
        queue_id: str,
        db: Session,
        user_id: str,
        asset_id: str,
        question: str,
        pdf_title: str = None
    ):
        """Process PDF question in background and put result in queue"""
        try:
            logger.info(f"Background RAG processing started for asset {asset_id}")
            start_time = time.time()
            
            # Process the PDF question asynchronously
            result = await self.pdf_qa_service.answer_question_about_pdf(
                db=db,
                user_id=user_id,
                question=question,
                asset_id=asset_id,
            )
            
            processing_time = time.time() - start_time
            
            if result["success"]:
                # Format the result for streaming
                background_result = {
                    "type": "rag_result",
                    "answer": result["answer"],
                    "method": result.get("method", "background_async"),
                    "chunks_used": result.get("chunks_used", 0),
                    "context_tokens": result.get("context_tokens", 0),
                    "relevant_chunks": result.get("relevant_chunks", []),
                    "pdf_title": pdf_title or f"PDF {asset_id[:8]}",
                    "asset_id": asset_id,
                    "processing_time": processing_time,
                    "background_processed": True,
                    "success": True
                }
            else:
                background_result = {
                    "type": "rag_result",
                    "answer": f"I couldn't answer that question about the PDF. {result['error']}",
                    "method": "background_error",
                    "chunks_used": 0,
                    "context_tokens": 0,
                    "relevant_chunks": [],
                    "pdf_title": pdf_title or f"PDF {asset_id[:8]}",
                    "asset_id": asset_id,
                    "processing_time": processing_time,
                    "background_processed": True,
                    "success": False,
                    "error": result['error']
                }
            
            # Put result in queue
            await self.queue_manager.put_result(queue_id, background_result)
            logger.info(
                f"Background RAG completed for asset {asset_id} in {processing_time:.3f}s"
            )
            
        except Exception as e:
            logger.error(f"Background RAG error for asset {asset_id}: {e!s}")
            error_result = {
                "type": "rag_result",
                "answer": f"Background processing failed: {e!s}",
                "method": "background_exception",
                "chunks_used": 0,
                "context_tokens": 0,
                "relevant_chunks": [],
                "pdf_title": pdf_title or f"PDF {asset_id[:8]}",
                "asset_id": asset_id,
                "processing_time": time.time() - start_time if 'start_time' in locals() else 0,
                "background_processed": True,
                "success": False,
                "error": str(e)
            }
            await self.queue_manager.put_result(queue_id, error_result)
    
    async def create_background_stream(self, queue_id: str) -> AsyncGenerator[str, None]:
        """Create a streaming response that yields background results as they become available"""
        try:
            # Initial response indicating background processing has started
            yield f"data: {json.dumps({'type': 'background_started', 'queue_id': queue_id})}\n\n"
            
            # Poll for results with exponential backoff
            timeout = 0.1
            max_timeout = 2.0
            total_wait = 0.0
            max_wait = 30.0  # Maximum wait time
            
            while total_wait < max_wait:
                result = await self.queue_manager.get_result(queue_id, timeout)
                
                if result:
                    # Stream the result
                    yield f"data: {json.dumps({'type': 'tool_output', 'content': result})}\n\n"
                    break
                    
                # Exponential backoff
                await asyncio.sleep(timeout)
                total_wait += timeout
                timeout = min(timeout * 1.5, max_timeout)
            
            # If no result after max wait time
            if total_wait >= max_wait:
                timeout_result = {
                    "type": "rag_result",
                    "answer": "Background processing timed out. Please try again.",
                    "method": "background_timeout",
                    "success": False,
                    "error": "Processing timeout"
                }
                yield f"data: {json.dumps({'type': 'tool_output', 'content': timeout_result})}\n\n"
            
            # Signal completion
            yield "data: [DONE]\n\n"
            
        except Exception as e:
            logger.error(f"Background streaming error: {e!s}")
            error_response = {
                "type": "rag_result",
                "answer": f"Streaming error: {e!s}",
                "method": "stream_error",
                "success": False,
                "error": str(e)
            }
            yield f"data: {json.dumps({'type': 'error', 'content': error_response})}\n\n"
            yield "data: [DONE]\n\n"
        finally:
            # Cleanup queue resources
            self.queue_manager.cleanup_queue(queue_id)


# Global instance for shared queue management
background_rag_service = BackgroundRAGService()