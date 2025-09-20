"""
Configuration management for LoreBridge application.

This module centralizes all configuration settings and provides
type-safe access to environment variables with proper validation.
"""

from functools import lru_cache

from pydantic import Field, validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings with all configuration in one place."""

    # Basic app settings
    APP_NAME: str = Field(
        default="LoreBridge API", alias="APP_NAME", description="Application name"
    )
    DEBUG: bool = Field(default=False, alias="DEBUG", description="Enable debug mode")
    LOG_LEVEL: str = Field(
        default="INFO", alias="LOG_LEVEL", description="Logging level"
    )
    ENVIRONMENT: str = Field(
        default="development", alias="ENVIRONMENT", description="Runtime environment"
    )

    # Database settings
    DB_USER: str = Field(alias="DB_USER", description="Database username")
    DB_PASSWORD: str = Field(alias="DB_PASSWORD", description="Database password")
    DB_HOST: str = Field(alias="DB_HOST", description="Database host")
    DB_PORT: int = Field(alias="DB_PORT", description="Database port")
    DB_NAME: str = Field(alias="DB_NAME", description="Database name")
    DATABASE_URL: str | None = Field(
        default=None, alias="DATABASE_URL", description="PostgreSQL connection string"
    )
    DB_ECHO: bool = Field(
        default=False, alias="DB_ECHO", description="Enable SQL query logging"
    )
    DB_POOL_SIZE: int = Field(
        default=20, alias="DB_POOL_SIZE", description="Connection pool size"
    )
    DB_MAX_OVERFLOW: int = Field(
        default=30, alias="DB_MAX_OVERFLOW", description="Max pool overflow"
    )
    DB_POOL_TIMEOUT: int = Field(
        default=30, alias="DB_POOL_TIMEOUT", description="Pool connection timeout in seconds"
    )
    DB_POOL_RECYCLE: int = Field(
        default=3600, alias="DB_POOL_RECYCLE", description="Connection recycle time in seconds"
    )

    # AI settings
    OPENAI_API_KEY: str = Field(alias="OPENAI_API_KEY", description="OpenAI API key")
    DEFAULT_LLM: str = Field(
        default="openai", alias="DEFAULT_LLM", description="Default LLM provider"
    )
    DEFAULT_MODEL: str = Field(
        default="gpt-4o", alias="DEFAULT_MODEL", description="Default AI model"
    )
    MAX_TOKENS: int = Field(
        default=4000, alias="MAX_TOKENS", description="Maximum tokens per request"
    )
    TEMPERATURE: float = Field(
        default=0.7, alias="TEMPERATURE", description="AI response randomness"
    )

    # Security settings
    CLERK_SECRET_KEY: str | None = Field(
        default=None,
        alias="CLERK_SECRET_KEY",
        description="Clerk authentication secret",
    )
    CLERK_JWKS_URL: str = Field(
        alias="CLERK_JWKS_URL", description="Clerk JWKS endpoint URL"
    )
    CLERK_WEBHOOK_SECRET: str | None = Field(
        default=None,
        alias="CLERK_WEBHOOK_SECRET",
        description="Clerk webhook verification secret",
    )
    CORS_ORIGINS: list[str] = Field(
        default=["http://localhost:3000", "http://localhost:3003", "https://lorebridge.com", "https://www.lorebridge.com"],
        alias="CORS_ORIGINS",
        description="Allowed CORS origins",
    )

    # Payment settings
    STRIPE_SECRET_KEY: str = Field(
        alias="STRIPE_SECRET_KEY", description="Stripe secret key"
    )
    STRIPE_PUBLISHABLE_KEY: str = Field(
        alias="STRIPE_PUBLISHABLE_KEY", description="Stripe publishable key"
    )
    STRIPE_WEBHOOK_SECRET: str = Field(
        alias="STRIPE_WEBHOOK_SECRET", description="Stripe webhook secret"
    )
    STRIPE_PRICE_ID_MONTHLY_PRO: str = Field(
        alias="STRIPE_PRICE_ID_MONTHLY_PRO", description="Stripe monthly pro price ID"
    )

    # External services
    PYTHON_TRANSCRIPT_SERVICE_URL: str = Field(
        alias="PYTHON_TRANSCRIPT_SERVICE_URL",
        description="Python transcript service URL",
    )
    PYTHON_TRANSCRIPT_SERVICE_API_KEY: str = Field(
        alias="PYTHON_TRANSCRIPT_SERVICE_API_KEY",
        description="Python transcript service API key",
    )
    SERPER_API_KEY: str = Field(alias="SERPER_API_KEY", description="Serper API key")
    FIRECRAWL_API_KEY: str = Field(
        alias="FIRECRAWL_API_KEY", description="Firecrawl API key"
    )

    # Storage settings
    STORAGE_DIR: str = Field(
        default="uploads", alias="STORAGE_DIR", description="File storage directory"
    )
    MAX_FILE_SIZE_MB: int = Field(
        default=4, alias="MAX_FILE_SIZE_MB", description="Max file size in MB"
    )
    ALLOWED_FILE_TYPES: str = Field(
        default=".pdf",
        alias="ALLOWED_FILE_TYPES",
        description="Allowed file extensions as comma-separated string (PDF only)",
    )

    # Computed properties
    @property
    def database_url(self) -> str:
        """Get database URL, constructing it if not provided."""
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return f"postgresql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    @validator("ENVIRONMENT")
    def validate_environment(cls, v: str) -> str:
        """Validate environment setting."""
        allowed = ["development", "staging", "production"]
        if v not in allowed:
            raise ValueError(f"Environment must be one of: {allowed}")
        return v
    
    @property
    def optimized_db_pool_size(self) -> int:
        """Get environment-optimized database pool size."""
        if self.ENVIRONMENT == "production":
            return max(self.DB_POOL_SIZE, 50)  # Minimum 50 for production
        elif self.ENVIRONMENT == "staging":
            return max(self.DB_POOL_SIZE, 20)  # Minimum 20 for staging
        else:
            return max(self.DB_POOL_SIZE, 5)   # Minimum 5 for development
    
    @property
    def optimized_db_max_overflow(self) -> int:
        """Get environment-optimized database max overflow."""
        if self.ENVIRONMENT == "production":
            return max(self.DB_MAX_OVERFLOW, 100)  # Minimum 100 for production
        elif self.ENVIRONMENT == "staging":
            return max(self.DB_MAX_OVERFLOW, 30)   # Minimum 30 for staging
        else:
            return max(self.DB_MAX_OVERFLOW, 10)   # Minimum 10 for development

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"  # Ignore extra fields from .env


@lru_cache
def get_settings() -> Settings:
    """
    Get cached settings instance.

    Uses lru_cache to ensure settings are only loaded once,
    improving performance and ensuring consistency.
    """
    return Settings()


# Global settings instance
settings = get_settings()
