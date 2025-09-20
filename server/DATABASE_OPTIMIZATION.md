# Database Optimization Guide

## Connection Pool Configuration

### Environment Variables

Add these to your `.env` file for optimal performance:

```bash
# PostgreSQL Connection Pool Settings
DB_POOL_SIZE=20          # Increased from 5 (4x improvement)
DB_MAX_OVERFLOW=30       # Increased from 10 (3x improvement)
DB_ECHO=false           # Set to true only for debugging

# Total possible connections: DB_POOL_SIZE + DB_MAX_OVERFLOW = 50 connections
```

### Production Recommendations

For high-traffic production environments:

```bash
# High-performance settings
DB_POOL_SIZE=50
DB_MAX_OVERFLOW=100
```

## Performance Improvements Implemented

### 1. **Increased Connection Pool Size**
- **Before**: 5 pool + 10 overflow = 15 total connections
- **After**: 20 pool + 30 overflow = 50 total connections  
- **Impact**: 233% increase in available database connections

### 2. **Connection Pool Optimizations**
- `pool_pre_ping=True`: Validates connections before use, prevents stale connections
- `pool_recycle=3600`: Recycles connections every hour to prevent timeouts
- Improved connection reuse and lifecycle management

### 3. **Async Database Operations**
- **Before**: Synchronous `db.commit()` operations blocked streaming responses
- **After**: Non-blocking async operations using thread pool executor
- **Impact**: Eliminates database I/O blocking during streaming

### 4. **Critical Async Conversions**

#### LLM Chat Endpoint (`/chat`)
- **Before**: `db.commit()` before streaming starts (blocking)
- **After**: Async user message persistence (non-blocking)

#### LangChain Chat Service
- **Before**: 3 synchronous DB operations during streaming
- **After**: All operations moved to background tasks

#### Artefact Processing
- **Before**: `db.commit()` after streaming completes (blocking)
- **After**: Async artefact updates (non-blocking)

## Monitoring Database Performance

### Check Connection Pool Usage

```python
from app.db.database import engine

# Check pool status
pool = engine.pool
print(f"Pool size: {pool.size()}")
print(f"Checked out connections: {pool.checkedout()}")
print(f"Overflow: {pool.overflow()}")
```

### PostgreSQL Monitoring Queries

```sql
-- Check active connections
SELECT count(*) as active_connections 
FROM pg_stat_activity 
WHERE state = 'active';

-- Check connection states
SELECT state, count(*) 
FROM pg_stat_activity 
GROUP BY state;

-- Check for slow queries
SELECT query, state, query_start 
FROM pg_stat_activity 
WHERE state != 'idle' 
AND query_start < now() - interval '30 seconds';
```

## Troubleshooting

### Connection Pool Exhaustion
If you see "connection pool exhausted" errors:
1. Increase `DB_POOL_SIZE` and `DB_MAX_OVERFLOW`
2. Check for connection leaks (unclosed sessions)
3. Monitor slow queries that hold connections too long

### High Database Load
If database CPU/memory is high:
1. Enable query logging temporarily (`DB_ECHO=true`)
2. Identify expensive queries
3. Add database indexes for frequently queried columns
4. Consider read replicas for read-heavy workloads

### Async Operation Failures
Check logs for async operation failures:
```python
# In your monitoring/logs
grep "Failed to.*asynchronously" server/logs/app.log
```

## Health Monitoring Endpoints

### Quick Health Check
```bash
curl http://localhost:8000/api/v1/health/database
```

### Detailed Health Check
```bash
curl http://localhost:8000/api/v1/health/detailed
```

### Health Monitoring Response
```json
{
  "status": "healthy",
  "database_connected": true,
  "connection_pool": {
    "size": 50,
    "checked_out": 12,
    "overflow": 0,
    "utilization_percent": 24.0
  },
  "async_operations": {
    "circuit_breaker_open": false,
    "failure_count": 0,
    "operation_timeout": 30.0
  },
  "recommendations": ["All systems operating normally"]
}
```

## Production Environment Variables

### Development (.env)
```bash
ENVIRONMENT=development
DB_POOL_SIZE=5
DB_MAX_OVERFLOW=10
DB_POOL_TIMEOUT=30
DB_POOL_RECYCLE=3600
```

### Staging (.env)
```bash
ENVIRONMENT=staging
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=30
DB_POOL_TIMEOUT=30
DB_POOL_RECYCLE=3600
```

### Production (.env)
```bash
ENVIRONMENT=production
DB_POOL_SIZE=50
DB_MAX_OVERFLOW=100
DB_POOL_TIMEOUT=30
DB_POOL_RECYCLE=3600
```

## Load Testing Recommendations

Test with realistic concurrent users:
```bash
# Use tools like Apache Bench or wrk
ab -n 1000 -c 50 http://localhost:8000/api/v1/llm/chat

# Monitor connection pool during load
watch -n 1 "psql -c \"SELECT count(*) FROM pg_stat_activity;\""

# Monitor health during load test
watch -n 5 "curl -s http://localhost:8000/api/v1/health/detailed | jq '.metrics.connection_pool.utilization_percent'"
```

## Production Features Implemented

### ✅ Circuit Breaker Pattern
- Automatically opens after 10 consecutive failures
- Prevents cascade failures during database issues
- Auto-resets after 60 seconds

### ✅ Timeout Handling
- 30-second timeout for all async database operations
- Prevents hanging operations from blocking threads

### ✅ Environment-Specific Scaling
- **Development**: 5 pool + 10 overflow = 15 connections
- **Staging**: 20 pool + 30 overflow = 50 connections  
- **Production**: 50 pool + 100 overflow = 150 connections

### ✅ Graceful Degradation
- Streaming continues even if async database operations fail
- User experience remains uninterrupted
- Failures are logged for monitoring

### ✅ Connection Pool Monitoring
- Real-time pool utilization metrics
- Health endpoints for monitoring systems
- Automated recommendations for optimization
