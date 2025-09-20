# Deployment Configuration Guide: Streaming API Changes

## Architecture Changes Made

We implemented a **dual API base system** to fix streaming while maintaining HTTPS security:

### Before (Broken Streaming)
- All requests routed through Next.js rewrites
- Streaming responses buffered and broken
- Single API base for all requests

### After (Working Streaming)
- **Regular API requests**: Use Next.js rewrites (same-origin)
- **Streaming requests**: Direct backend connection (bypass rewrites)
- **Dual API base functions**: `getApiBase()` and `getStreamingApiBase()`

## Required Environment Variables

### Frontend (.env.local / Production)
```bash
# Required for server-side operations and streaming
API_ORIGIN=https://api.yourdomain.com

# Fallback for client-side (still needed)
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

### Critical Notes
- **`API_ORIGIN`** is server-only (more secure)
- **`NEXT_PUBLIC_API_URL`** is client-accessible (less secure)
- **Both should have the same value in production**
- **Missing `API_ORIGIN` will cause streaming to fail with error**: `"API_ORIGIN must be set for streaming in production"`

## Backend CORS Configuration Required

Since browsers now directly connect to the backend for streaming, CORS must be configured:

### FastAPI (server/app/main.py)
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://yourdomain.com",        # Production frontend
        "https://www.yourdomain.com",    # Production with www
        "http://localhost:3000",         # Development
        "http://localhost:3001",         # Alternative dev port
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=[
        "Authorization", 
        "Content-Type",
        "Accept",
        "Origin",
        "X-Requested-With"
    ],
)
```

## Network/Infrastructure Requirements

### 1. Backend Accessibility
- Backend must be **publicly accessible** (not just internally)
- Browsers will directly connect to `https://api.yourdomain.com`
- Firewall rules must allow external connections

### 2. SSL Certificate
- Backend needs **valid SSL certificate**
- Self-signed certificates will be rejected by browsers
- Certificate must match the domain in `API_ORIGIN`

### 3. DNS Configuration
```bash
# Ensure DNS points to backend
api.yourdomain.com → Backend Server IP
```

## Deployment Checklist

### ✅ Environment Variables
- [ ] `API_ORIGIN` set in production environment
- [ ] `NEXT_PUBLIC_API_URL` set as fallback
- [ ] Both use HTTPS URLs (not HTTP)

### ✅ Backend Configuration
- [ ] CORS middleware added with correct origins
- [ ] SSL certificate installed and valid
- [ ] Backend publicly accessible on specified domain/port

### ✅ Network Configuration
- [ ] DNS resolution working for API domain
- [ ] Firewall allows external connections to backend
- [ ] Load balancer (if used) configured for both HTTP and streaming

### ✅ Testing
- [ ] Regular API calls work (should use rewrites)
- [ ] Streaming chat works (should bypass rewrites)
- [ ] No CORS errors in browser console
- [ ] HTTPS enforced (no mixed content warnings)

## Common Deployment Errors

### 1. CORS Blocked
```
Access to fetch at 'https://api.yourdomain.com' from origin 'https://yourdomain.com' has been blocked by CORS policy
```
**Fix**: Add frontend domain to backend CORS configuration

### 2. Mixed Content
```
Mixed Content: The page at 'https://yourdomain.com' was loaded over HTTPS, but requested an insecure resource 'http://api.yourdomain.com'
```
**Fix**: Ensure `API_ORIGIN` uses HTTPS

### 3. Streaming Fails
```
Error: API_ORIGIN must be set for streaming in production
```
**Fix**: Set `API_ORIGIN` environment variable

### 4. Network Unreachable
```
TypeError: Failed to fetch
```
**Fix**: Ensure backend is publicly accessible and DNS resolves correctly

## Architecture Benefits

✅ **Security**: HTTPS enforced, environment-specific configurations
✅ **Performance**: Regular requests cached via Next.js, streaming optimized
✅ **Flexibility**: Can deploy frontend/backend on different infrastructure
✅ **Debugging**: Clear separation between proxied and direct requests

## Migration Impact

This change **requires coordination between frontend and backend deployments**:
1. Deploy backend with CORS configuration first
2. Deploy frontend with new environment variables
3. Test streaming functionality
4. Monitor for CORS/network issues

**Breaking Change**: Existing deployments without proper CORS configuration will have broken streaming until backend is updated.

## Files Modified

### Frontend Changes
- `client/lib/apiBase.ts` - Added `getStreamingApiBase()` function
- `client/components/flow/context/ChatContext.tsx` - Uses streaming API base for chat
- `client/lib/useChatAPI.ts` - Uses streaming API base for chat API
- `client/next.config.ts` - Added rewrites for non-streaming requests

### Backend Changes Required
- `server/app/main.py` - Must add CORS middleware configuration

## Development vs Production Behavior

### Development
- **Regular requests**: `'' → /api/v1/endpoint → http://localhost:8000/api/v1/endpoint`
- **Streaming requests**: `http://localhost:8000/api/v1/langchain-chat` (direct)
- **CORS**: Not enforced by browsers for localhost

### Production
- **Regular requests**: `'' → /api/v1/endpoint → https://api.yourdomain.com/api/v1/endpoint` (via rewrites)
- **Streaming requests**: `https://api.yourdomain.com/api/v1/langchain-chat` (direct)
- **CORS**: Enforced by browsers, must be configured on backend