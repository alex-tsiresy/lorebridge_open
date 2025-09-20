import json
import logging
from typing import Dict, Any

from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models.chat_message import ChatMessage
from app.db.models.chat_session import ChatSession

logger = logging.getLogger(__name__)

# System prompt for generating descriptive text for artifacts
ARTIFACT_DESCRIPTION_SYSTEM_PROMPT = """You are an expert at creating comprehensive, detailed descriptions of data artifacts. Your goal is to generate clear, informative text that fully explains what an artifact contains so it can be transmitted to other conversations as context.

**YOUR TASK:**
Generate a detailed description that explains:
1. **What the artifact is** (table, diagram type, etc.)
2. **What it contains** (data categories, structure, relationships)
3. **Key insights and patterns** found in the data
4. **Evidence from the source context** that supports the artifact's content
5. **How to interpret** the information presented

**DESCRIPTION STYLE:**
- Write as if explaining to someone who cannot see the artifact
- Include specific data points, numbers, and relationships
- Mention trends, patterns, and notable findings
- Reference the source conversation context that informed the artifact
- Use clear, structured language that preserves all important information
- Include quantitative details (counts, percentages, values) where relevant

**FOR TABLES:**
- Describe the table structure (rows, columns, categories)
- Explain what each column represents
- Highlight key data points, trends, and comparisons
- Mention sorting or filtering capabilities if relevant
- Include specific examples from the data

**FOR MERMAID DIAGRAMS:**
- Identify the diagram type (flowchart, sequence, class, etc.)
- Describe the flow, process, or relationships shown
- Explain each component and how they connect
- Highlight decision points, loops, or conditional paths
- Describe the overall process or system being modeled

**EVIDENCE REQUIREMENT:**
Always include specific references to the source conversation that led to this artifact. Mention:
- What topics were discussed that informed the content
- Specific data points or examples that were mentioned
- Questions or problems the artifact helps address
- How the artifact synthesizes or organizes the conversation content

Your description should be comprehensive enough that someone reading it can understand the full context and content without seeing the original artifact."""

class ArtefactDescriptionService:
    """Service for generating descriptive text for artifacts to enable transmission between chats."""
    
    def __init__(self, db: Session, model_name: str = "gpt-4o"):
        self.db = db
        self.llm = ChatOpenAI(
            model_name=model_name,
            temperature=0.3,
            openai_api_key=settings.OPENAI_API_KEY
        )
    
    def generate_table_description(self, table_data: Dict[str, Any], chat_session_id: str) -> str:
        """
        Generate a comprehensive description of a table artifact.
        
        Args:
            table_data: The table JSON data structure
            chat_session_id: ID of the chat session that generated this table
            
        Returns:
            Detailed descriptive text explaining the table content and context
        """
        try:
            # Get the source conversation context
            context = self._get_chat_context(chat_session_id)
            
            # Prepare the table data for analysis
            table_summary = self._summarize_table_structure(table_data)
            
            # Build the prompt
            messages = [
                SystemMessage(content=ARTIFACT_DESCRIPTION_SYSTEM_PROMPT),
                HumanMessage(content=f"""
SOURCE CONVERSATION CONTEXT:
{context}

TABLE ARTIFACT TO DESCRIBE:
{table_summary}

FULL TABLE DATA:
{json.dumps(table_data, indent=2)}

Generate a comprehensive description of this table artifact that explains what it contains, key insights, and how it relates to the source conversation. Include specific data points and evidence from the context.
""")
            ]
            
            # Generate description
            response = self.llm(messages)
            return response.content.strip()
            
        except Exception as e:
            logger.error(f"Error generating table description: {e}", exc_info=True)
            return f"Table artifact generated from conversation {chat_session_id}. Contains {len(table_data.get('data', []))} rows with columns: {', '.join([col.get('title', col.get('key', '')) for col in table_data.get('columns', [])])}."
    
    def generate_mermaid_description(self, mermaid_source: str, chat_session_id: str) -> str:
        """
        Generate a comprehensive description of a mermaid diagram artifact.
        
        Args:
            mermaid_source: The mermaid diagram source code
            chat_session_id: ID of the chat session that generated this diagram
            
        Returns:
            Detailed descriptive text explaining the diagram content and context
        """
        try:
            # Get the source conversation context
            context = self._get_chat_context(chat_session_id)
            
            # Analyze the mermaid diagram structure
            diagram_analysis = self._analyze_mermaid_structure(mermaid_source)
            
            # Build the prompt
            messages = [
                SystemMessage(content=ARTIFACT_DESCRIPTION_SYSTEM_PROMPT),
                HumanMessage(content=f"""
SOURCE CONVERSATION CONTEXT:
{context}

MERMAID DIAGRAM ARTIFACT TO DESCRIBE:
Type: {diagram_analysis['type']}
Components: {diagram_analysis['components']}
Connections: {diagram_analysis['connections']}

FULL MERMAID SOURCE:
```mermaid
{mermaid_source}
```

Generate a comprehensive description of this mermaid diagram that explains the process, relationships, or structure it represents, and how it relates to the source conversation. Include specific references to the diagram elements and evidence from the context.
""")
            ]
            
            # Generate description
            response = self.llm(messages)
            return response.content.strip()
            
        except Exception as e:
            logger.error(f"Error generating mermaid description: {e}", exc_info=True)
            return f"Mermaid diagram artifact generated from conversation {chat_session_id}. Type: {self._get_diagram_type(mermaid_source)}."
    
    def _get_chat_context(self, chat_session_id: str) -> str:
        """Get the conversation context from the chat session."""
        try:
            session = self.db.query(ChatSession).filter(ChatSession.id == chat_session_id).first()
            if not session:
                return "No conversation context available."
            
            messages = (
                self.db.query(ChatMessage)
                .filter(ChatMessage.chat_session_id == chat_session_id)
                .order_by(ChatMessage.timestamp)
                .all()
            )
            
            if not messages:
                return "No conversation messages available."
            
            # Build conversation context
            context_lines = []
            for msg in messages:
                role = msg.role or "user"
                content = msg.content[:1000] if msg.content else ""  # Limit length
                context_lines.append(f"{role}: {content}")
            
            return "\n".join(context_lines)
            
        except Exception as e:
            logger.error(f"Error getting chat context: {e}", exc_info=True)
            return "Error retrieving conversation context."
    
    def _summarize_table_structure(self, table_data: Dict[str, Any]) -> str:
        """Summarize the table structure for analysis."""
        try:
            title = table_data.get('table_title', 'Untitled Table')
            description = table_data.get('table_description', 'No description')
            columns = table_data.get('columns', [])
            data = table_data.get('data', [])
            metadata = table_data.get('metadata', {})
            
            summary = f"Title: {title}\n"
            summary += f"Description: {description}\n"
            summary += f"Rows: {len(data)}\n"
            summary += f"Columns: {len(columns)}\n"
            
            if columns:
                summary += "Column Details:\n"
                for col in columns:
                    summary += f"  - {col.get('title', col.get('key', 'Unknown'))}: {col.get('type', 'unknown')} type\n"
            
            if metadata:
                summary += f"Metadata: {json.dumps(metadata)}\n"
            
            return summary
            
        except Exception as e:
            logger.error(f"Error summarizing table structure: {e}", exc_info=True)
            return "Table structure analysis failed."
    
    def _analyze_mermaid_structure(self, mermaid_source: str) -> Dict[str, Any]:
        """Analyze the mermaid diagram structure."""
        try:
            lines = [line.strip() for line in mermaid_source.split('\n') if line.strip()]
            
            # Determine diagram type
            diagram_type = self._get_diagram_type(mermaid_source)
            
            # Count components and connections
            components = []
            connections = []
            
            for line in lines:
                if '-->' in line or '---' in line or '-.->' in line:
                    connections.append(line)
                elif line and not line.startswith(('graph', 'sequenceDiagram', 'classDiagram', 'stateDiagram', 'gantt', 'erDiagram', 'journey')):
                    components.append(line)
            
            return {
                'type': diagram_type,
                'components': len(components),
                'connections': len(connections),
                'component_details': components[:10],  # First 10 for analysis
                'connection_details': connections[:10]  # First 10 for analysis
            }
            
        except Exception as e:
            logger.error(f"Error analyzing mermaid structure: {e}", exc_info=True)
            return {'type': 'unknown', 'components': 0, 'connections': 0}
    
    def _get_diagram_type(self, mermaid_source: str) -> str:
        """Extract the diagram type from mermaid source."""
        first_line = mermaid_source.split('\n')[0].strip()
        
        if first_line.startswith('graph'):
            return 'flowchart'
        elif first_line.startswith('sequenceDiagram'):
            return 'sequence diagram'
        elif first_line.startswith('classDiagram'):
            return 'class diagram'
        elif first_line.startswith('stateDiagram'):
            return 'state diagram'
        elif first_line.startswith('gantt'):
            return 'gantt chart'
        elif first_line.startswith('erDiagram'):
            return 'entity relationship diagram'
        elif first_line.startswith('journey'):
            return 'user journey'
        else:
            return 'unknown diagram type'
