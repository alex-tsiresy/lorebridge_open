import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Config:
    """Application configuration"""
    
    # Flask configuration
    DEBUG = os.environ.get('DEBUG', 'False').lower() == 'true'
    PORT = int(os.environ.get('PORT', 5001))
    
    # Proxy configuration
    WEBSHARE_USERNAME = os.environ.get('WEBSHARE_USERNAME')
    WEBSHARE_PASSWORD = os.environ.get('WEBSHARE_PASSWORD')
    
    # Deepgram configuration
    DEEPGRAM_API_KEY = os.environ.get('DEEPGRAM_API_KEY')
    
    # Gemini configuration
    GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
    
    # Security configuration
    API_KEYS = [key.strip() for key in os.environ.get('API_KEYS', '').split(',') if key.strip()]
    
    @property
    def has_proxy_config(self):
        """Check if proxy configuration is available"""
        return bool(self.WEBSHARE_USERNAME and self.WEBSHARE_PASSWORD)
    
    @property
    def has_deepgram_config(self):
        """Check if Deepgram configuration is available"""
        return bool(self.DEEPGRAM_API_KEY)
    
    @property
    def has_gemini_config(self):
        """Check if Gemini configuration is available"""
        return bool(self.GEMINI_API_KEY)
    
    @property
    def has_api_keys(self):
        """Check if API keys are configured"""
        return bool(self.API_KEYS) 