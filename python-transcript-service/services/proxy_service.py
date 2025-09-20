import logging
from youtube_transcript_api.proxies import WebshareProxyConfig
from config import Config

logger = logging.getLogger(__name__)
config = Config()

def get_proxy_config():
    """Get Webshare proxy configuration if available"""
    if config.has_proxy_config:
        logger.info(f"Using Webshare proxy with username: {config.WEBSHARE_USERNAME}-1")
        return WebshareProxyConfig(
            proxy_username=f"{config.WEBSHARE_USERNAME}-1",
            proxy_password=config.WEBSHARE_PASSWORD,
        )
    else:
        logger.info("No Webshare proxy configured - using direct connection")
        return None

def get_yt_dlp_proxy_config():
    """Get yt-dlp proxy configuration if available"""
    if config.has_proxy_config:
        # Use the correct Webshare proxy endpoint from dashboard
        # Format: http://username-1:password@p.webshare.io:80
        proxy_url = f"http://{config.WEBSHARE_USERNAME}-1:{config.WEBSHARE_PASSWORD}@p.webshare.io:80"
        logger.info(f"Using Webshare proxy: {config.WEBSHARE_USERNAME}-1@p.webshare.io:80")
        return proxy_url
    return None 