import logging
from flask import Flask
from flask_cors import CORS
from config import Config
from routes.api_routes import api_bp
from routes.youtube_routes import youtube_bp
from routes.instagram_routes import instagram_bp

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)
logger.info("🚀 Transcript Service module loaded – application initializing")

def create_app():
    """Application factory function"""
    app = Flask(__name__)
    CORS(app)
    
    # Register blueprints
    app.register_blueprint(api_bp)  # Health and status endpoints
    app.register_blueprint(youtube_bp)  # Platform-specific YouTube routes
    app.register_blueprint(instagram_bp)  # Platform-specific Instagram routes
    
    return app

# Create the app at module level for Gunicorn
config = Config()
app = create_app()

if __name__ == '__main__':
    logger.info(f"Starting Enhanced Transcript Service on port {config.PORT}")
    
    # Log service configuration
    logger.info("📝 Service Configuration:")
    logger.info(f"   Port: {config.PORT}")
    logger.info(f"   Debug: {config.DEBUG}")
    
    # Log API configuration
    if config.DEEPGRAM_API_KEY:
        logger.info("✅ Deepgram API configured - audio transcription enabled")
    else:
        logger.warning("⚠️  Deepgram API not configured - audio transcription disabled")
    
    if config.GEMINI_API_KEY:
        logger.info("✅ Gemini API configured - video summarization enabled")
    else:
        logger.warning("⚠️  Gemini API not configured - video summarization disabled")
    
    # Log security configuration
    if config.has_api_keys:
        logger.info(f"✅ API key authentication enabled ({len(config.API_KEYS)} keys configured)")
    else:
        logger.warning("⚠️  No API keys configured - service is open!")
    
    app.run(host='0.0.0.0', port=config.PORT, debug=config.DEBUG) 