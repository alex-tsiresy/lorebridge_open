"""
Service for handling user subscription limits and restrictions
"""
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models.graph import Graph
from app.db.models.node import Node
from app.models.user import User


class UserLimitsService:
    """Service for checking and enforcing user subscription limits"""

    @staticmethod
    def is_pro_user(user: User) -> bool:
        """
        Check if user has pro subscription status

        Args:
            user: User model instance

        Returns:
            True if user has pro access, False otherwise
        """
        settings = get_settings()
        
        # In development mode, all users are pro by default for testing
        if settings.ENVIRONMENT == "development":
            return True
        
        pro_statuses = ["trialing", "active"]
        return user.subscription_status in pro_statuses

    @staticmethod
    def get_board_limit(user: User) -> int:
        """
        Get the maximum number of boards allowed for user

        Args:
            user: User model instance

        Returns:
            Maximum number of boards allowed
        """
        return float('inf') if UserLimitsService.is_pro_user(user) else 3

    @staticmethod
    def get_user_board_count(db: Session, user_id: str) -> int:
        """
        Get current number of boards for user

        Args:
            db: Database session
            user_id: User ID

        Returns:
            Number of boards user currently has
        """
        return db.query(Graph).filter(Graph.user_id == user_id).count()

    @staticmethod
    def can_create_board(db: Session, user: User) -> bool:
        """
        Check if user can create another board

        Args:
            db: Database session
            user: User model instance

        Returns:
            True if user can create another board, False otherwise
        """
        if UserLimitsService.is_pro_user(user):
            return True

        current_count = UserLimitsService.get_user_board_count(db, str(user.id))
        max_allowed = UserLimitsService.get_board_limit(user)

        return current_count < max_allowed

    @staticmethod
    def get_board_limit_message(user: User) -> str:
        """
        Get user-friendly message about board limits

        Args:
            user: User model instance

        Returns:
            Message explaining board limits
        """
        if UserLimitsService.is_pro_user(user):
            return "Pro users can create unlimited boards and nodes"
        else:
            return "Free users are limited to 3 boards with 8 nodes each. Upgrade to Pro for unlimited boards and nodes"

    @staticmethod
    def get_node_limit_per_board(user: User) -> int:
        """
        Get the maximum number of nodes allowed per board for user

        Args:
            user: User model instance

        Returns:
            Maximum number of nodes allowed per board
        """
        return float('inf') if UserLimitsService.is_pro_user(user) else 8

    @staticmethod
    def get_board_node_count(db: Session, graph_id: str) -> int:
        """
        Get current number of nodes in a specific board

        Args:
            db: Database session
            graph_id: Graph/Board ID

        Returns:
            Number of nodes in the board
        """
        return db.query(Node).filter(Node.graph_id == graph_id).count()

    @staticmethod
    def can_create_node(db: Session, user: User, graph_id: str) -> bool:
        """
        Check if user can create another node in the specified board

        Args:
            db: Database session
            user: User model instance
            graph_id: Graph/Board ID

        Returns:
            True if user can create another node, False otherwise
        """
        if UserLimitsService.is_pro_user(user):
            return True

        current_count = UserLimitsService.get_board_node_count(db, graph_id)
        max_allowed = UserLimitsService.get_node_limit_per_board(user)

        return current_count < max_allowed

    @staticmethod
    def get_node_limit_message(user: User) -> str:
        """
        Get user-friendly message about node limits

        Args:
            user: User model instance

        Returns:
            Message explaining node limits
        """
        if UserLimitsService.is_pro_user(user):
            return "Pro users can create unlimited nodes per board"
        else:
            return "Free users are limited to 8 nodes per board. Upgrade to Pro for unlimited nodes"

