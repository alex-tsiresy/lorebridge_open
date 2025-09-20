from functools import wraps
from flask import request, jsonify
from config import Config

config = Config()

def require_api_key(f):
    """Decorator to require API key authentication"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Check for API key in headers
        api_key = request.headers.get('X-API-Key') or request.headers.get('Authorization')
        
        if not api_key:
            return jsonify({"error": "API key required. Provide X-API-Key header."}), 401
        
        # Remove 'Bearer ' prefix if present
        if api_key.startswith('Bearer '):
            api_key = api_key[7:]
        
        # Check if API key is valid
        if not config.has_api_keys or api_key not in config.API_KEYS:
            return jsonify({"error": "Invalid API key"}), 401
        
        return f(*args, **kwargs)
    return decorated_function 