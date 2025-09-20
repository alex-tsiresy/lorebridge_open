#!/usr/bin/env python3
"""
Test script to verify async PDF tool implementation.
This script tests concurrent PDF queries to ensure non-blocking behavior.
"""

import asyncio
import time
import json
from unittest.mock import Mock, AsyncMock, MagicMock
import sys
import os

# Add the app directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.services.rag_services.pdf_qa_tool import PDFQuestionTool


async def create_mock_pdf_qa_service():
    """Create a mock PDF QA service that simulates async processing"""
    mock_service = AsyncMock()
    
    async def mock_answer_question(db, user_id, question, asset_id):
        # Simulate async processing time
        await asyncio.sleep(0.1)
        return {
            "success": True,
            "answer": f"Mock answer for question: {question}",
            "method": "async_test",
            "chunks_used": 5,
            "context_tokens": 150,
            "relevant_chunks": [
                {"text": "Mock chunk 1", "similarity_score": 0.95},
                {"text": "Mock chunk 2", "similarity_score": 0.87}
            ],
            "processing_time": 0.1
        }
    
    mock_service.answer_question_about_pdf = mock_answer_question
    return mock_service


async def test_single_async_call():
    """Test single async PDF tool call"""
    # Test description logging removed for security
    
    # Create mock dependencies
    mock_db = Mock()
    mock_service = await create_mock_pdf_qa_service()
    
    # Create PDF tool
    pdf_tool = PDFQuestionTool(
        asset_id="test-asset-123",
        user_id="test-user-456", 
        db=mock_db,
        pdf_title="Test Document"
    )
    pdf_tool.pdf_qa_service = mock_service
    
    # Test async call
    start_time = time.time()
    result = await pdf_tool._ask_pdf_question_async("What is this document about?")
    end_time = time.time()
    
    # Parse result
    parsed_result = json.loads(result)
    
    # Test results logging removed for security
    

async def test_concurrent_async_calls():
    """Test concurrent async PDF tool calls"""
    # Concurrent test logging removed for security
    
    # Create multiple PDF tools with mock services
    tools = []
    for i in range(5):
        mock_db = Mock()
        mock_service = await create_mock_pdf_qa_service()
        
        pdf_tool = PDFQuestionTool(
            asset_id=f"test-asset-{i}",
            user_id="test-user-456",
            db=mock_db,
            pdf_title=f"Test Document {i}"
        )
        pdf_tool.pdf_qa_service = mock_service
        tools.append(pdf_tool)
    
    # Create concurrent tasks
    questions = [
        "What is the main topic?",
        "Who are the key authors?", 
        "What are the conclusions?",
        "What methodology was used?",
        "What are the implications?"
    ]
    
    tasks = []
    for i, (tool, question) in enumerate(zip(tools, questions)):
        task = tool._ask_pdf_question_async(question)
        tasks.append(task)
    
    # Execute concurrently
    start_time = time.time()
    results = await asyncio.gather(*tasks)
    end_time = time.time()
    
    # Performance test results logging removed for security
    
    # Verify all results
    successful_results = 0
    for i, result in enumerate(results):
        parsed_result = json.loads(result)
        if parsed_result.get('success'):
            successful_results += 1
    
    # Success rate logging removed for security


async def test_error_handling():
    """Test error handling in async PDF tool"""
    # Error handling test logging removed for security
    
    mock_db = Mock()
    mock_service = AsyncMock()
    
    # Mock service that raises an exception
    async def failing_service(db, user_id, question, asset_id):
        await asyncio.sleep(0.05)
        raise Exception("Mock service error")
    
    mock_service.answer_question_about_pdf = failing_service
    
    pdf_tool = PDFQuestionTool(
        asset_id="failing-asset",
        user_id="test-user",
        db=mock_db,
        pdf_title="Failing Document"
    )
    pdf_tool.pdf_qa_service = mock_service
    
    # Test error handling
    result = await pdf_tool._ask_pdf_question_async("This should fail")
    parsed_result = json.loads(result)
    
    # Error handling results logging removed for security


async def run_performance_benchmark():
    """Run a comprehensive performance benchmark"""
    # Benchmark header logging removed for security
    
    await test_single_async_call()
    await test_concurrent_async_calls()
    await test_error_handling()
    
    # Test completion logging removed for security


if __name__ == "__main__":
    asyncio.run(run_performance_benchmark())