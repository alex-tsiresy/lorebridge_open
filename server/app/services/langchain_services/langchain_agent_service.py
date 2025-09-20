import os
from typing import Any, Dict, List
from langchain.chat_models import init_chat_model
from langchain_community.utilities import GoogleSerperAPIWrapper
from langchain_core.tools import Tool
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, ToolMessage
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from typing_extensions import Annotated, TypedDict

from app.core.config import settings
from app.core.logger import logger
from app.services.rag_services.dynamic_tool_factory import create_dynamic_tools_for_chat


class AgentState(TypedDict):
    """State for the async agent graph"""
    messages: Annotated[List[BaseMessage], add_messages]


class LangChainAgentService:
    """Service for creating and configuring LangChain agents"""

    def __init__(self):
        # Ensure SERPER_API_KEY is loaded into the environment
        os.environ["SERPER_API_KEY"] = os.getenv(
            "SERPER_API_KEY", getattr(settings, "SERPER_API_KEY", "")
        )

    def _get_temperature(self, model: str, temperature: float = None) -> float:
        """Determine the appropriate temperature for the model"""
        if model == "o4-mini" or model.startswith("o1"):
            return 1.0
        elif temperature is not None:
            return temperature
        return 0.7  # Default temperature

    def _create_llm(self, model: str, temperature: float) -> any:
        """Create and configure the LLM"""
        return init_chat_model(
            model or "gpt-4.1",
            model_provider="openai",
            temperature=temperature,
            api_key=settings.OPENAI_API_KEY,
            streaming=True,
            max_retries=3,
        )

    def _create_search_tool(self) -> Tool:
        """Create the web search tool"""
        search = GoogleSerperAPIWrapper()
        return Tool(
            name="web_search",
            func=search.results,
            description="Useful for when you need to search the web and get structured metadata, including links, snippets, and knowledge graph info. Use this for current events, general knowledge, or information not available in connected documents.",
        )


    def _create_async_agent_graph(self, llm: Any, tools: List[Tool]) -> StateGraph:
        """Create an async agent graph using LangGraph"""
        # Create tool node for async tool execution
        tool_node = ToolNode(tools)
        
        # Create the graph
        workflow = StateGraph(AgentState)
        
        # Add nodes with sync functions (LangGraph requires sync functions for .stream())
        def call_model_node(state):
            messages = state["messages"]
            response = llm.invoke(messages)  # Use sync invoke for stream compatibility
            return {"messages": [response]}
        
        workflow.add_node("agent", call_model_node)
        workflow.add_node("tools", tool_node)
        
        # Set entry point
        workflow.set_entry_point("agent")
        
        # Add conditional edges
        def should_continue(state):
            messages = state["messages"]
            last_message = messages[-1]
            
            # If the last message has tool calls, go to tools
            if hasattr(last_message, 'tool_calls') and last_message.tool_calls:
                return "tools"
            
            # Otherwise, end the conversation
            return END
            
        workflow.add_conditional_edges(
            "agent",
            should_continue,
            {
                "tools": "tools",
                END: END
            }
        )
        
        # Add edge from tools back to agent
        workflow.add_edge("tools", "agent")
        
        return workflow.compile()

    def create_agent(
        self,
        session_id: str,
        user_id: str,
        model: str,
        temperature: float = None,
        db=None,
    ) -> tuple:
        """Create a native async LangChain agent with all necessary tools"""
        # Determine temperature
        temp = self._get_temperature(model, temperature)

        # Create LLM with tool binding
        llm = self._create_llm(model, temp)

        # Create tools
        tools = [self._create_search_tool()]

        # Add dynamic tools
        if db:
            dynamic_tools = create_dynamic_tools_for_chat(session_id, db, user_id)
            tools.extend(dynamic_tools)

            # Log RAG tools for debugging
            rag_tools = [
                tool.name
                for tool in dynamic_tools
                if "pdf" in tool.name.lower() or "rag" in tool.name.lower()
            ]
            if rag_tools:
                logger.info(f"RAG tools available: {rag_tools}")

        # Bind tools to LLM for function calling
        llm_with_tools = llm.bind_tools(tools)

        # Create async agent graph
        agent = self._create_async_agent_graph(llm_with_tools, tools)

        logger.info(f"Created async agent with {len(tools)} tools for session {session_id}")
        
        # Return both agent and tools for context processing
        return agent, tools
