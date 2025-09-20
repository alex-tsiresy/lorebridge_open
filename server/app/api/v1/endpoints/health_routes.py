"""
Health monitoring endpoints for database and async operations.

This module provides endpoints for monitoring database connection pool,
async operation health, and overall system status.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.logger import logger
from app.db.database import engine, get_db
from app.services.async_db_service import async_db_service

router = APIRouter()


@router.get("/health/database")
async def database_health():
    """Get database connection pool health status."""
    try:
        pool = engine.pool
        
        # Get async service health
        async_health = async_db_service.get_health_status()
        
        # Test basic database connectivity
        try:
            with engine.connect() as conn:
                conn.execute("SELECT 1")
            database_connected = True
        except Exception as e:
            logger.error(f"Database connectivity test failed: {e}")
            database_connected = False
        
        return {
            "status": "healthy" if database_connected and not async_health["circuit_breaker_open"] else "degraded",
            "database_connected": database_connected,
            "connection_pool": {
                "size": pool.size(),
                "checked_out": pool.checkedout(),
                "overflow": pool.overflow(),
                "checked_in": pool.checkedin(),
            },
            "async_operations": async_health,
            "recommendations": _get_health_recommendations(pool, async_health)
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}", exc_info=True)
        return {
            "status": "unhealthy",
            "error": str(e),
            "database_connected": False
        }


@router.get("/health/detailed")
async def detailed_health_check(db: Session = Depends(get_db)):
    """Comprehensive health check including database query test."""
    try:
        # Test database query
        try:
            db.execute("SELECT COUNT(*) FROM pg_stat_activity")
            query_test = True
        except Exception as e:
            logger.error(f"Database query test failed: {e}")
            query_test = False
        
        # Get pool status
        pool = engine.pool
        pool_status = {
            "size": pool.size(),
            "checked_out": pool.checkedout(),
            "overflow": pool.overflow(),
            "checked_in": pool.checkedin(),
            "utilization_percent": round((pool.checkedout() / pool.size()) * 100, 2)
        }
        
        # Get async service health
        async_health = async_db_service.get_health_status()
        
        # Overall health assessment
        is_healthy = (
            query_test and 
            not async_health["circuit_breaker_open"] and
            pool_status["utilization_percent"] < 90
        )
        
        return {
            "status": "healthy" if is_healthy else "degraded",
            "checks": {
                "database_query": query_test,
                "connection_pool_available": pool_status["utilization_percent"] < 90,
                "async_operations": not async_health["circuit_breaker_open"]
            },
            "metrics": {
                "connection_pool": pool_status,
                "async_operations": async_health
            },
            "recommendations": _get_detailed_recommendations(pool_status, async_health)
        }
    except Exception as e:
        logger.error(f"Detailed health check failed: {e}", exc_info=True)
        return {
            "status": "unhealthy",
            "error": str(e)
        }


def _get_health_recommendations(pool, async_health) -> list[str]:
    """Generate health recommendations based on current status."""
    recommendations = []
    
    utilization = (pool.checkedout() / pool.size()) * 100 if pool.size() > 0 else 0
    
    if utilization > 80:
        recommendations.append(f"High connection pool utilization ({utilization:.1f}%) - consider increasing DB_POOL_SIZE")
    
    if pool.overflow() > 0:
        recommendations.append(f"Using overflow connections ({pool.overflow()}) - consider increasing DB_POOL_SIZE")
    
    if async_health["circuit_breaker_open"]:
        recommendations.append("Async operations circuit breaker is open - database issues detected")
    
    if async_health["failure_count"] > 0:
        recommendations.append(f"Recent async operation failures ({async_health['failure_count']}) - monitor database performance")
    
    if not recommendations:
        recommendations.append("All systems operating normally")
    
    return recommendations


def _get_detailed_recommendations(pool_status, async_health) -> list[str]:
    """Generate detailed recommendations for optimization."""
    recommendations = []
    
    if pool_status["utilization_percent"] > 70:
        recommendations.append(
            f"Connection pool utilization at {pool_status['utilization_percent']}% - "
            "consider scaling up database connections"
        )
    
    if async_health["failure_count"] >= async_health["circuit_breaker_threshold"] // 2:
        recommendations.append(
            "Async operation failures approaching circuit breaker threshold - "
            "investigate database performance"
        )
    
    if pool_status["overflow"] > pool_status["size"] // 2:
        recommendations.append(
            "Frequent overflow connection usage - increase base pool size"
        )
    
    return recommendations if recommendations else ["System operating optimally"]
