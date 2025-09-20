"""Test user routes."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from unittest.mock import Mock, patch

from app.db.models.graph import Graph
from app.models.user import User


class TestUserRoutes:
    """Test user-related endpoints."""

    @patch("app.core.dependencies.verify_jwt")
    def test_ensure_user_in_db_new_user(
        self, mock_verify_jwt: Mock, client: TestClient, db_session: Session
    ) -> None:
        """Test creating a new user in database."""
        # Mock JWT verification
        mock_verify_jwt.return_value = {
            "sub": "user_123",
            "email": "test@example.com"
        }
        
        response = client.post(
            "/api/v1/users/ensure-in-db",
            headers={"Authorization": "Bearer mock_token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["user_id"] == "user_123"
        assert data["email"] == "test@example.com"
        
        # Verify user was created in database
        user = db_session.query(User).filter(User.id == "user_123").first()
        assert user is not None
        assert user.email == "test@example.com"

    @patch("app.core.dependencies.verify_jwt")
    def test_ensure_user_in_db_existing_user(
        self, mock_verify_jwt: Mock, client: TestClient, db_session: Session
    ) -> None:
        """Test retrieving existing user from database."""
        # Create existing user
        existing_user = User(
            id="existing_user_123",
            email="existing@example.com",
            is_subscribed=True
        )
        db_session.add(existing_user)
        db_session.commit()
        
        # Mock JWT verification
        mock_verify_jwt.return_value = {
            "sub": "existing_user_123",
            "email": "existing@example.com"
        }
        
        response = client.post(
            "/api/v1/users/ensure-in-db",
            headers={"Authorization": "Bearer mock_token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["user_id"] == "existing_user_123"
        assert data["email"] == "existing@example.com"
        assert data["is_subscribed"] is True

    def test_ensure_user_unauthorized(self, client: TestClient) -> None:
        """Test unauthorized access to user endpoint."""
        response = client.post("/api/v1/users/ensure-in-db")
        assert response.status_code == 401

    @patch("app.core.dependencies.verify_jwt")
    def test_get_user_graphs(
        self, mock_verify_jwt: Mock, client: TestClient, db_session: Session
    ) -> None:
        """Test getting user graphs."""
        # Mock JWT verification
        mock_verify_jwt.return_value = {
            "sub": "user_with_graphs",
            "email": "graphs@example.com"
        }
        
        # Create user with graphs
        user = User(id="user_with_graphs", email="graphs@example.com")
        db_session.add(user)
        
        graph1 = Graph(
            id="graph_1",
            name="Test Graph 1",
            user_id="user_with_graphs",
            description="First test graph"
        )
        graph2 = Graph(
            id="graph_2",
            name="Test Graph 2",
            user_id="user_with_graphs",
            description="Second test graph"
        )
        db_session.add_all([graph1, graph2])
        db_session.commit()
        
        response = client.get(
            "/api/v1/users/graphs",
            headers={"Authorization": "Bearer mock_token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        
        graph_names = [graph["name"] for graph in data]
        assert "Test Graph 1" in graph_names
        assert "Test Graph 2" in graph_names

    @patch("app.core.dependencies.verify_jwt")
    def test_get_user_subscription_status(
        self, mock_verify_jwt: Mock, client: TestClient, db_session: Session
    ) -> None:
        """Test getting user subscription status."""
        # Mock JWT verification
        mock_verify_jwt.return_value = {
            "sub": "subscribed_user",
            "email": "sub@example.com"
        }
        
        # Create subscribed user
        user = User(
            id="subscribed_user",
            email="sub@example.com",
            is_subscribed=True,
            stripe_customer_id="cus_test123"
        )
        db_session.add(user)
        db_session.commit()
        
        response = client.get(
            "/api/v1/users/subscription",
            headers={"Authorization": "Bearer mock_token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["is_subscribed"] is True
        assert data["stripe_customer_id"] == "cus_test123"