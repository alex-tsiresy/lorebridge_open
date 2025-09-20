import re
from urllib.parse import urlparse

def extract_video_id(url):
    """Extract video ID from YouTube URL"""
    patterns = [
        r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)',
        r'youtube\.com\/watch\?.*v=([^&\n?#]+)'
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    
    return None

def is_youtube_url(url):
    """Check if URL is a YouTube URL"""
    youtube_domains = ['youtube.com', 'youtu.be', 'www.youtube.com', 'm.youtube.com']
    try:
        parsed = urlparse(url)
        return any(domain in parsed.netloc for domain in youtube_domains)
    except:
        return False

def is_instagram_url(url):
    """Check if URL is an Instagram URL"""
    instagram_domains = ['instagram.com', 'www.instagram.com']
    try:
        parsed = urlparse(url)
        return any(domain in parsed.netloc for domain in instagram_domains)
    except:
        return False 