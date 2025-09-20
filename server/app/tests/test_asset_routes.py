"""Test asset routes."""
import io
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from unittest.mock import Mock, patch
from uuid import uuid4

from app.db.models.asset import Asset, AssetType
from app.db.models.graph import Graph
from app.models.user import User


class TestAssetRoutes:
    """Test asset-related endpoints."""

    @patch("app.core.dependencies.verify_jwt")
    @patch("app.services.assets.pdf_asset_service.PdfAssetService.process_asset")
    def test_upload_pdf_asset(
        self, 
        mock_process_asset: Mock,
        mock_verify_jwt: Mock, 
        client: TestClient, 
        db_session: Session
    ) -> None:
        """Test uploading a PDF asset."""
        # Mock JWT verification
        mock_verify_jwt.return_value = {
            "sub": "pdf_uploader",
            "email": "uploader@example.com"
        }
        
        # Mock asset processing
        mock_process_asset.return_value = None
        
        # Create user and graph
        user = User(id="pdf_uploader", email="uploader@example.com")
        db_session.add(user)
        
        graph_id = str(uuid4())
        graph = Graph(
            id=graph_id,
            name="Test Graph",
            user_id="pdf_uploader"
        )
        db_session.add(graph)
        db_session.commit()
        
        # Create a mock PDF file
        pdf_content = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
        pdf_file = io.BytesIO(pdf_content)
        
        response = client.post(
            f"/api/v1/assets/upload/{graph_id}",
            files={"file": ("test.pdf", pdf_file, "application/pdf")},
            data={"asset_type": "pdf"},
            headers={"Authorization": "Bearer mock_token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["asset_type"] == "pdf"
        assert data["graph_id"] == graph_id
        assert data["user_id"] == "pdf_uploader"
        assert "id" in data
        
        # Verify asset was created in database
        asset = db_session.query(Asset).filter(Asset.id == data["id"]).first()
        assert asset is not None
        assert asset.asset_type == AssetType.PDF

    @patch("app.core.dependencies.verify_jwt")
    def test_get_asset(
        self, mock_verify_jwt: Mock, client: TestClient, db_session: Session
    ) -> None:
        """Test retrieving an asset by ID."""
        # Mock JWT verification
        mock_verify_jwt.return_value = {
            "sub": "asset_viewer",
            "email": "viewer@example.com"
        }
        
        # Create user, graph, and asset
        user = User(id="asset_viewer", email="viewer@example.com")
        db_session.add(user)
        
        graph_id = str(uuid4())
        graph = Graph(
            id=graph_id,
            name="Test Graph",
            user_id="asset_viewer"
        )
        db_session.add(graph)
        
        asset_id = str(uuid4())
        asset = Asset(
            id=asset_id,
            asset_type=AssetType.PDF,
            graph_id=graph_id,
            user_id="asset_viewer",
            file_name="test.pdf",
            original_name="test.pdf"
        )
        db_session.add(asset)
        db_session.commit()
        
        response = client.get(
            f"/api/v1/assets/{asset_id}",
            headers={"Authorization": "Bearer mock_token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == asset_id
        assert data["asset_type"] == "pdf"
        assert data["file_name"] == "test.pdf"

    @patch("app.core.dependencies.verify_jwt")
    def test_get_graph_assets(
        self, mock_verify_jwt: Mock, client: TestClient, db_session: Session
    ) -> None:
        """Test retrieving all assets for a graph."""
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
            name="Graph with Assets",
            user_id="graph_owner"
        )
        db_session.add(graph)
        
        # Create multiple assets
        asset1 = Asset(
            id=str(uuid4()),
            asset_type=AssetType.PDF,
            graph_id=graph_id,
            user_id="graph_owner",
            file_name="doc1.pdf",
            original_name="doc1.pdf"
        )
        asset2 = Asset(
            id=str(uuid4()),
            asset_type=AssetType.WEBSITE,
            graph_id=graph_id,
            user_id="graph_owner",
            url="https://example.com",
            original_name="Example Website"
        )
        db_session.add_all([asset1, asset2])
        db_session.commit()
        
        response = client.get(
            f"/api/v1/graphs/{graph_id}/assets",
            headers={"Authorization": "Bearer mock_token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        
        asset_types = [asset["asset_type"] for asset in data]
        assert "pdf" in asset_types
        assert "website" in asset_types

    @patch("app.core.dependencies.verify_jwt")
    @patch("app.services.content.firecrawl_service.FirecrawlService.scrape_url")
    def test_create_website_asset(
        self,
        mock_scrape_url: Mock,
        mock_verify_jwt: Mock,
        client: TestClient,
        db_session: Session
    ) -> None:
        """Test creating a website asset."""
        # Mock JWT verification
        mock_verify_jwt.return_value = {
            "sub": "website_creator",
            "email": "creator@example.com"
        }
        
        # Mock website scraping
        mock_scrape_url.return_value = {
            "title": "Example Website",
            "content": "This is example content",
            "url": "https://example.com"
        }
        
        # Create user and graph
        user = User(id="website_creator", email="creator@example.com")
        db_session.add(user)
        
        graph_id = str(uuid4())
        graph = Graph(
            id=graph_id,
            name="Test Graph",
            user_id="website_creator"
        )
        db_session.add(graph)
        db_session.commit()
        
        website_data = {
            "url": "https://example.com",
            "asset_type": "website"
        }
        
        response = client.post(
            f"/api/v1/assets/website/{graph_id}",
            json=website_data,
            headers={"Authorization": "Bearer mock_token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["asset_type"] == "website"
        assert data["url"] == "https://example.com"
        assert data["graph_id"] == graph_id
        
        # Verify asset was created in database
        asset = db_session.query(Asset).filter(Asset.id == data["id"]).first()
        assert asset is not None
        assert asset.asset_type == AssetType.WEBSITE

    @patch("app.core.dependencies.verify_jwt")
    def test_delete_asset(
        self, mock_verify_jwt: Mock, client: TestClient, db_session: Session
    ) -> None:
        """Test deleting an asset."""
        # Mock JWT verification
        mock_verify_jwt.return_value = {
            "sub": "asset_deleter",
            "email": "deleter@example.com"
        }
        
        # Create user, graph, and asset
        user = User(id="asset_deleter", email="deleter@example.com")
        db_session.add(user)
        
        graph_id = str(uuid4())
        graph = Graph(
            id=graph_id,
            name="Test Graph",
            user_id="asset_deleter"
        )
        db_session.add(graph)
        
        asset_id = str(uuid4())
        asset = Asset(
            id=asset_id,
            asset_type=AssetType.PDF,
            graph_id=graph_id,
            user_id="asset_deleter",
            file_name="delete_me.pdf",
            original_name="delete_me.pdf"
        )
        db_session.add(asset)
        db_session.commit()
        
        response = client.delete(
            f"/api/v1/assets/{asset_id}",
            headers={"Authorization": "Bearer mock_token"}
        )
        
        assert response.status_code == 200
        
        # Verify deletion in database
        deleted_asset = db_session.query(Asset).filter(Asset.id == asset_id).first()
        assert deleted_asset is None

    @patch("app.core.dependencies.verify_jwt")
    def test_unauthorized_asset_access(
        self, mock_verify_jwt: Mock, client: TestClient, db_session: Session
    ) -> None:
        """Test that users cannot access other users' assets."""
        # Mock JWT verification for user A
        mock_verify_jwt.return_value = {
            "sub": "user_a",
            "email": "usera@example.com"
        }
        
        # Create user B, graph, and asset
        user_b = User(id="user_b", email="userb@example.com")
        db_session.add(user_b)
        
        graph_id = str(uuid4())
        graph_b = Graph(
            id=graph_id,
            name="User B's Graph",
            user_id="user_b"
        )
        db_session.add(graph_b)
        
        asset_id = str(uuid4())
        asset_b = Asset(
            id=asset_id,
            asset_type=AssetType.PDF,
            graph_id=graph_id,
            user_id="user_b",
            file_name="private.pdf",
            original_name="private.pdf"
        )
        db_session.add(asset_b)
        db_session.commit()
        
        # User A tries to access User B's asset
        response = client.get(
            f"/api/v1/assets/{asset_id}",
            headers={"Authorization": "Bearer mock_token"}
        )
        
        # Should return 404 or 403
        assert response.status_code in [404, 403]

    def test_upload_without_auth(self, client: TestClient) -> None:
        """Test uploading asset without authentication."""
        pdf_file = io.BytesIO(b"fake pdf content")
        
        response = client.post(
            "/api/v1/assets/upload/some-graph-id",
            files={"file": ("test.pdf", pdf_file, "application/pdf")},
            data={"asset_type": "pdf"}
        )
        
        assert response.status_code == 401