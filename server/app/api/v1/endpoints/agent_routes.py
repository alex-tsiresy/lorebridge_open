from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.auth_decorators import require_auth
from app.core.config import settings
from app.core.rate_limiter import limiter, PROCESSING_RATE_LIMIT
from app.db.database import get_db
from app.models.user import User as DBUser
from app.schemas.agent import AgentInput, AgentResponse
from app.services.langchain_services.agent_service import AgentService

router = APIRouter()

# Authentication handled by centralized auth module


# Dependency for the AgentService (instantiated once per request or globally)
def get_agent_service():
    return AgentService()


@router.post("/process_agent_query", response_model=AgentResponse)
@limiter.limit(PROCESSING_RATE_LIMIT)
async def process_agent_query(
    request: Request,
    input_data: AgentInput, 
    agent_service: AgentService = Depends(get_agent_service),
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(require_auth()),
):
    """
    Endpoint to send a query to the LoreBridge agent and get a story/lore response.
    Requires Clerk authentication and has rate limiting for processing protection.
    """
    
    try:
        response = await agent_service.run_agent_process(input_data)
        return response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while processing the LoreBridge agent query: {e}",
        ) from e
