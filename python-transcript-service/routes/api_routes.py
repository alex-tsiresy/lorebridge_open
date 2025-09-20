import logging
from flask import Blueprint, jsonify
from config import Config

logger = logging.getLogger(__name__)
config = Config()

# Create Blueprint for API routes
api_bp = Blueprint('api', __name__)

@api_bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint - no auth required"""
    
    return jsonify({
        "status": "healthy", 
        "service": "transcript-service",
    })