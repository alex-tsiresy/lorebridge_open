"""Test configuration and fixtures."""
import asyncio
import os
from typing import AsyncGenerator, Generator

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from httpx import AsyncClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.db.database import Base, get_db
from app.main import app

# Use in-memory SQLite for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session")
def event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="function")
def db_session() -> Generator[Session, None, None]:
    """Create a fresh database session for each test."""
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session: Session) -> Generator[TestClient, None, None]:
    """Create a TestClient with overridden database dependency."""
    def override_get_db() -> Generator[Session, None, None]:
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest_asyncio.fixture(scope="function")
async def async_client(db_session: Session) -> AsyncGenerator[AsyncClient, None]:
    """Create an AsyncClient for testing async endpoints."""
    def override_get_db() -> Generator[Session, None, None]:
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(app=app, base_url="http://test") as async_test_client:
        yield async_test_client
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def mock_user_id() -> str:
    """Mock user ID for testing."""
    return "test_user_123"


@pytest.fixture(scope="function")
def mock_auth_headers() -> dict[str, str]:
    """Mock authentication headers for testing."""
    return {
        "Authorization": "Bearer mock_jwt_token",
        "Content-Type": "application/json"
    }


@pytest.fixture(scope="session", autouse=True)
def setup_test_env() -> None:
    """Set up test environment variables."""
    os.environ["TESTING"] = "1"
    os.environ["DATABASE_URL"] = SQLALCHEMY_DATABASE_URL
    os.environ["OPENAI_API_KEY"] = "test_key"
    os.environ["CLERK_JWKS_URL"] = "https://test.clerk.accounts.dev/.well-known/jwks.json"