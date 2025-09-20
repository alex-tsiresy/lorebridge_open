"""Test graph routes."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from unittest.mock import Mock, patch
from uuid import uuid4

from app.db.models.graph import Graph
from app.models.user import User


class TestGraphRoutes:
    """Test graph-related endpoints."""

    @patch("app.core.dependencies.verify_jwt")
    def test_create_graph(
        self, mock_verify_jwt: Mock, client: TestClient, db_session: Session
    ) -> None:
        """Test creating a new graph."""
        # Mock JWT verification
        mock_verify_jwt.return_value = {
            "sub": "graph_creator",
            "email": "creator@example.com"
        }
        
        # Create user
        user = User(id="graph_creator", email="creator@example.com")
        db_session.add(user)
        db_session.commit()
        
        graph_data = {
            "name": "New Test Graph",
            "description": "A graph for testing",
            "emoji": "🧪"
        }
        
        response = client.post(
            "/api/v1/graphs/",
            json=graph_data,
            headers={"Authorization": "Bearer mock_token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "New Test Graph"
        assert data["description"] == "A graph for testing"
        assert data["emoji"] == "🧪"
        assert data["user_id"] == "graph_creator"
        assert "id" in data
        
        # Verify graph was created in database
        graph = db_session.query(Graph).filter(Graph.id == data["id"]).first()
        assert graph is not None
        assert graph.name == "New Test Graph"

    @patch("app.core.dependencies.verify_jwt")
    def test_get_graph(
        self, mock_verify_jwt: Mock, client: TestClient, db_session: Session
    ) -> None:
        """Test retrieving a graph by ID."""
        # Mock JWT verification
        mock_verify_jwt.return_value = {
            "sub": "graph_owner",
            "email": "owner@example.com"
        }
        
        # Create user and graph
        user = User(id="graph_owner", email="owner@example.com")
        db_session.add(user)
        
        graph_id = str(uuid4())
        graph = Graph(
            id=graph_id,
            name="Test Graph",
            description="Test description",
            user_id="graph_owner",
            emoji="📊"
        )
        db_session.add(graph)
        db_session.commit()
        
        response = client.get(
            f"/api/v1/graphs/{graph_id}",
            headers={"Authorization": "Bearer mock_token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == graph_id
        assert data["name"] == "Test Graph"
        assert data["description"] == "Test description"
        assert data["emoji"] == "📊"

    @patch("app.core.dependencies.verify_jwt")
    def test_get_graph_not_found(
        self, mock_verify_jwt: Mock, client: TestClient
    ) -> None:
        """Test retrieving non-existent graph."""
        # Mock JWT verification
        mock_verify_jwt.return_value = {
            "sub": "user_123",
            "email": "test@example.com"
        }
        
        fake_graph_id = str(uuid4())
        response = client.get(
            f"/api/v1/graphs/{fake_graph_id}",
            headers={"Authorization": "Bearer mock_token"}
        )
        
        assert response.status_code == 404

    @patch("app.core.dependencies.verify_jwt")
    def test_update_graph(
        self, mock_verify_jwt: Mock, client: TestClient, db_session: Session
    ) -> None:
        """Test updating a graph."""
        # Mock JWT verification
        mock_verify_jwt.return_value = {
            "sub": "graph_editor",
            "email": "editor@example.com"
        }
        
        # Create user and graph
        user = User(id="graph_editor", email="editor@example.com")
        db_session.add(user)
        
        graph_id = str(uuid4())
        graph = Graph(
            id=graph_id,
            name="Original Name",
            description="Original description",
            user_id="graph_editor"
        )
        db_session.add(graph)
        db_session.commit()
        
        update_data = {
            "name": "Updated Name",
            "description": "Updated description",
            "emoji": "✨"
        }
        
        response = client.put(
            f"/api/v1/graphs/{graph_id}",
            json=update_data,
            headers={"Authorization": "Bearer mock_token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["description"] == "Updated description"
        assert data["emoji"] == "✨"
        
        # Verify update in database
        updated_graph = db_session.query(Graph).filter(Graph.id == graph_id).first()
        assert updated_graph.name == "Updated Name"
        assert updated_graph.description == "Updated description"

    @patch("app.core.dependencies.verify_jwt")
    def test_delete_graph(
        self, mock_verify_jwt: Mock, client: TestClient, db_session: Session
    ) -> None:
        """Test deleting a graph."""
        # Mock JWT verification
        mock_verify_jwt.return_value = {
            "sub": "graph_deleter",
            "email": "deleter@example.com"
        }
        
        # Create user and graph
        user = User(id="graph_deleter", email="deleter@example.com")
        db_session.add(user)
        
        graph_id = str(uuid4())
        graph = Graph(
            id=graph_id,
            name="Graph to Delete",
            user_id="graph_deleter"
        )
        db_session.add(graph)
        db_session.commit()
        
        response = client.delete(
            f"/api/v1/graphs/{graph_id}",
            headers={"Authorization": "Bearer mock_token"}
        )
        
        assert response.status_code == 200
        
        # Verify deletion in database
        deleted_graph = db_session.query(Graph).filter(Graph.id == graph_id).first()
        assert deleted_graph is None

    @patch("app.core.dependencies.verify_jwt")
    def test_unauthorized_access(self, mock_verify_jwt: Mock, client: TestClient) -> None:
        """Test unauthorized access to graph endpoints."""
        # Test without authorization header
        response = client.get("/api/v1/graphs/some-id")
        assert response.status_code == 401
        
        response = client.post("/api/v1/graphs/", json={"name": "Test"})
        assert response.status_code == 401

    @patch("app.core.dependencies.verify_jwt")
    def test_access_other_user_graph(
        self, mock_verify_jwt: Mock, client: TestClient, db_session: Session
    ) -> None:
        """Test that users cannot access other users' graphs."""
        # Mock JWT verification for user A
        mock_verify_jwt.return_value = {
            "sub": "user_a",
            "email": "usera@example.com"
        }
        
        # Create user B and their graph
        user_b = User(id="user_b", email="userb@example.com")
        db_session.add(user_b)
        
        graph_id = str(uuid4())
        graph_b = Graph(
            id=graph_id,
            name="User B's Graph",
            user_id="user_b"
        )
        db_session.add(graph_b)
        db_session.commit()
        
        # User A tries to access User B's graph
        response = client.get(
            f"/api/v1/graphs/{graph_id}",
            headers={"Authorization": "Bearer mock_token"}
        )
        
        # Should return 404 or 403 (depending on implementation)
        assert response.status_code in [404, 403]