"""
Service Factory - Main entry point for the restructured services

This factory creates and wires together all the service components in the correct dependency order.
It provides a clean interface for the rest of the application to use.
"""

import logging
from typing import Optional
from config import Config
from services.proxy_service import get_proxy_config, get_yt_dlp_proxy_config

# External API wrappers
from services.external.youtube_transcript_api import YouTubeTranscriptAPI
from services.external.deepgram_api import DeepgramAPI
from services.external.gemini_api import GeminiAPI
from services.external.ytdlp_api import YtDlpAPI

# Core business logic
from services.core.transcript_processor import TranscriptProcessor
from services.core.media_downloader import MediaDownloader
from services.core.video_summarizer import VideoSummarizer

# Workflows
from services.workflows.transcript_workflow import TranscriptWorkflow
from services.workflows.video_workflow import VideoWorkflow

logger = logging.getLogger(__name__)

class ServiceFactory:
    """Factory for creating and wiring together all service components"""
    
    def __init__(self):
        """Initialize the service factory"""
        self.config = Config()
        self._transcript_workflow = None
        self._video_workflow = None
    
    def get_transcript_workflow(self) -> TranscriptWorkflow:
        """
        Get the transcript workflow (creates if not exists)
        
        Returns:
            Configured transcript workflow
        """
        if self._transcript_workflow is None:
            self._transcript_workflow = self._create_transcript_workflow()
        
        return self._transcript_workflow
    
    def get_video_workflow(self) -> VideoWorkflow:
        """
        Get the video workflow (creates if not exists)
        
        Returns:
            Configured video workflow
        """
        if self._video_workflow is None:
            self._video_workflow = self._create_video_workflow()
        
        return self._video_workflow
    
    def _create_transcript_workflow(self) -> TranscriptWorkflow:
        """
        Create and configure the transcript workflow
        
        Returns:
            Configured transcript workflow
        """
        logger.info("Creating transcript workflow")
        
        # Create external APIs
        youtube_api = self._create_youtube_api()
        deepgram_api = self._create_deepgram_api()
        ytdlp_api = self._create_ytdlp_api()
        
        # Create core business logic
        transcript_processor = TranscriptProcessor(youtube_api, deepgram_api)
        media_downloader = MediaDownloader(ytdlp_api)
        
        # Create workflow
        return TranscriptWorkflow(transcript_processor, media_downloader)
    
    def _create_video_workflow(self) -> VideoWorkflow:
        """
        Create and configure the video workflow
        
        Returns:
            Configured video workflow
        """
        logger.info("Creating video workflow")
        
        # Create external APIs
        ytdlp_api = self._create_ytdlp_api()
        gemini_api = self._create_gemini_api()
        
        # Create core business logic
        media_downloader = MediaDownloader(ytdlp_api)
        video_summarizer = VideoSummarizer(gemini_api) if gemini_api else None
        
        if not video_summarizer:
            logger.warning("Video summarizer not available - Gemini API not configured")
        
        # Create workflow
        return VideoWorkflow(media_downloader, video_summarizer)
    
    def _create_youtube_api(self) -> YouTubeTranscriptAPI:
        """
        Create YouTube Transcript API with proxy configuration
        
        Returns:
            Configured YouTube Transcript API
        """
        proxy_config = get_proxy_config()
        return YouTubeTranscriptAPI(proxy_config)
    
    def _create_deepgram_api(self) -> Optional[DeepgramAPI]:
        """
        Create Deepgram API if configured
        
        Returns:
            Configured Deepgram API or None if not configured
        """
        if not self.config.has_deepgram_config:
            logger.warning("Deepgram API not configured")
            return None
        
        return DeepgramAPI(self.config.DEEPGRAM_API_KEY)
    
    def _create_gemini_api(self) -> Optional[GeminiAPI]:
        """
        Create Gemini API if configured
        
        Returns:
            Configured Gemini API or None if not configured
        """
        if not self.config.has_gemini_config:
            logger.warning("Gemini API not configured")
            return None
        
        return GeminiAPI(self.config.GEMINI_API_KEY)
    
    def _create_ytdlp_api(self) -> YtDlpAPI:
        """
        Create yt-dlp API with proxy configuration
        
        Returns:
            Configured yt-dlp API
        """
        proxy_url = get_yt_dlp_proxy_config()
        return YtDlpAPI(proxy_url)
    
    def is_deepgram_available(self) -> bool:
        """Check if Deepgram API is available"""
        return self.config.has_deepgram_config
    
    def is_gemini_available(self) -> bool:
        """Check if Gemini API is available"""
        return self.config.has_gemini_config
    
    def is_proxy_available(self) -> bool:
        """Check if proxy configuration is available"""
        return self.config.has_proxy_config

# Global factory instance
service_factory = ServiceFactory() 