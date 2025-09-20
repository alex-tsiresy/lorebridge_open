"""Test main application endpoints."""
import pytest
from fastapi.testclient import TestClient


def test_health_check(client: TestClient) -> None:
    """Test health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "lorebridge-api"


def test_root_endpoint(client: TestClient) -> None:
    """Test root endpoint."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "LoreBridge" in data["message"]


def test_cors_headers(client: TestClient) -> None:
    """Test CORS headers are present."""
    response = client.get("/", headers={"Origin": "http://localhost:3000"})
    assert response.status_code == 200
    # CORS headers should be present for cross-origin requests


def test_openapi_docs(client: TestClient) -> None:
    """Test that OpenAPI docs are accessible."""
    response = client.get("/docs")
    assert response.status_code == 200
    
    response = client.get("/redoc")
    assert response.status_code == 200
    
    response = client.get("/openapi.json")
    assert response.status_code == 200