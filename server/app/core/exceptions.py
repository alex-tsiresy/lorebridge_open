"""
Custom exception classes for LoreBridge application.

This module provides structured exception handling with clear error types,
making debugging easier and improving API error responses.
"""

from typing import Any

from fastapi import HTTPException
from pydantic import BaseModel


class LoreBridgeError(Exception):
    """Base exception class for LoreBridge application errors."""

    def __init__(
        self,
        message: str,
        error_code: str = "LOREBRIDGE_ERROR",
        details: dict[str, Any] | None = None,
    ):
        self.message = message
        self.error_code = error_code
        self.details = details or {}
        super().__init__(self.message)


class ServiceError(LoreBridgeError):
    """Exception raised when a service operation fails."""

    def __init__(
        self,
        service_name: str,
        operation: str,
        message: str,
        details: dict[str, Any] | None = None,
    ):
        self.service_name = service_name
        self.operation = operation
        super().__init__(
            message=f"{service_name} service failed during {operation}: {message}",
            error_code="SERVICE_ERROR",
            details=details,
        )


class ValidationError(LoreBridgeError):
    """Exception raised when data validation fails."""

    def __init__(self, field: str, message: str, value: Any = None):
        self.field = field
        self.value = value
        super().__init__(
            message=f"Validation failed for {field}: {message}",
            error_code="VALIDATION_ERROR",
            details={"field": field, "value": value},
        )


class ResourceNotFoundError(LoreBridgeError):
    """Exception raised when a requested resource is not found."""

    def __init__(self, resource_type: str, resource_id: str):
        self.resource_type = resource_type
        self.resource_id = resource_id
        super().__init__(
            message=f"{resource_type} with ID {resource_id} not found",
            error_code="RESOURCE_NOT_FOUND",
            details={"resource_type": resource_type, "resource_id": resource_id},
        )


class AuthenticationError(LoreBridgeError):
    """Exception raised when authentication fails."""

    def __init__(self, message: str = "Authentication failed"):
        super().__init__(message=message, error_code="AUTHENTICATION_ERROR")


class AuthorizationError(LoreBridgeError):
    """Exception raised when authorization fails."""

    def __init__(self, resource: str, action: str):
        self.resource = resource
        self.action = action
        super().__init__(
            message=f"Not authorized to {action} {resource}",
            error_code="AUTHORIZATION_ERROR",
            details={"resource": resource, "action": action},
        )


class ExternalServiceError(LoreBridgeError):
    """Exception raised when external service calls fail."""

    def __init__(
        self,
        service_name: str,
        status_code: int | None = None,
        message: str = "External service error",
    ):
        self.service_name = service_name
        self.status_code = status_code
        super().__init__(
            message=f"{service_name} service error: {message}",
            error_code="EXTERNAL_SERVICE_ERROR",
            details={"service": service_name, "status_code": status_code},
        )


class ProcessingError(LoreBridgeError):
    """Exception raised when data processing fails."""

    def __init__(
        self, process_type: str, message: str, input_data: dict[str, Any] | None = None
    ):
        self.process_type = process_type
        self.input_data = input_data
        super().__init__(
            message=f"{process_type} processing failed: {message}",
            error_code="PROCESSING_ERROR",
            details={"process_type": process_type, "input_data": input_data},
        )


# Error Response Models
class ErrorResponse(BaseModel):
    """Standardized error response model."""

    error: bool = True
    error_code: str
    message: str
    details: dict[str, Any] | None = None
    timestamp: str | None = None


class ErrorHandler:
    """Centralized error handling utilities."""

    @staticmethod
    def to_http_exception(error: LoreBridgeError) -> HTTPException:
        """Convert LoreBridge exception to FastAPI HTTPException."""
        status_code_map = {
            "VALIDATION_ERROR": 400,
            "AUTHENTICATION_ERROR": 401,
            "AUTHORIZATION_ERROR": 403,
            "RESOURCE_NOT_FOUND": 404,
            "EXTERNAL_SERVICE_ERROR": 502,
            "SERVICE_ERROR": 500,
            "PROCESSING_ERROR": 500,
            "LOREBRIDGE_ERROR": 500,
        }

        status_code = status_code_map.get(error.error_code, 500)

        return HTTPException(
            status_code=status_code,
            detail={
                "error": True,
                "error_code": error.error_code,
                "message": error.message,
                "details": error.details,
            },
        )

    @staticmethod
    def log_error(
        error: LoreBridgeError, logger, context: dict[str, Any] | None = None
    ):
        """Log error with structured data."""
        log_data = {
            "error_code": error.error_code,
            "message": error.message,
            "details": error.details,
            "context": context or {},
        }
        logger.error("LoreBridge error occurred", extra=log_data)
