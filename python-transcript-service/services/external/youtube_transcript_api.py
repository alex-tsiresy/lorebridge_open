import logging
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import YouTubeRequestFailed
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class YouTubeTranscriptAPI:
    """Pure API wrapper for YouTube Transcript API - just the raw API calls"""
    
    def __init__(self, proxy_config=None):
        """
        Initialize the YouTube Transcript API wrapper
        
        Args:
            proxy_config: Optional proxy configuration for the API
        """
        self.proxy_config = proxy_config
    
    def fetch_transcript(self, video_id: str) -> Dict[str, Any]:
        """
        Fetch transcript from YouTube API - raw API call only
        
        Args:
            video_id: YouTube video ID
            
        Returns:
            Raw API response wrapped in success/error format
        """
        try:
            logger.info(f"Attempting to fetch transcript for video ID: {video_id}")
            
            if self.proxy_config:
                logger.info("Using proxy configuration for YouTube API call")
                ytt_api = YouTubeTranscriptApi(proxy_config=self.proxy_config)
                transcript_result = ytt_api.get_transcript(video_id)
            else:
                logger.info("Using direct connection for YouTube API call")
                transcript_result = YouTubeTranscriptApi.get_transcript(video_id)
            
            logger.info(f"Successfully fetched transcript for video ID: {video_id}")
            return {
                'success': True,
                'data': transcript_result
            }
            
        except YouTubeRequestFailed as e:
            error_message = str(e)
            logger.error(f"YouTube API request failed for video ID {video_id}: {error_message}")
            
            # Log additional details about the specific error
            if "transcript" in error_message.lower() and "not available" in error_message.lower():
                logger.error("Reason: Video has no transcript available")
            elif "too many requests" in error_message.lower() or "429" in error_message:
                logger.error("Reason: Rate limit exceeded")
            elif "video unavailable" in error_message.lower():
                logger.error("Reason: Video is unavailable or private")
            else:
                logger.error(f"Reason: {error_message}")
            
            return {
                'success': False,
                'error': error_message,
                'error_type': 'youtube_request_failed'
            }
        except Exception as e:
            error_message = str(e)
            logger.error(f"Unexpected error while fetching transcript for video ID {video_id}: {error_message}")
            
            return {
                'success': False,
                'error': error_message,
                'error_type': 'unexpected_error'
            } 