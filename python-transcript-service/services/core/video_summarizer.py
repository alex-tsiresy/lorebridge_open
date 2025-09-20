import os
import time
import logging
import mimetypes
from typing import Dict, Any, Optional
from services.external.gemini_api import GeminiAPI
from google.genai import types

logger = logging.getLogger(__name__)

class VideoSummarizer:
    """Core business logic for video summarization"""
    
    def __init__(self, gemini_api: GeminiAPI):
        """
        Initialize video summarizer
        
        Args:
            gemini_api: Gemini API instance
        """
        self.gemini_api = gemini_api
    
    def summarize_video_file(self, video_path: str, platform: str = "unknown") -> Dict[str, Any]:
        """
        Summarize a video file with intelligent processing and cleanup
        
        Args:
            video_path: Path to the video file
            platform: Platform the video came from
            
        Returns:
            Summarization result
        """
        uploaded_file = None
        
        try:
            if not os.path.exists(video_path):
                return {
                    'success': False,
                    'error': 'Video file not found'
                }
            
            logger.info(f"Uploading and analyzing video file: {video_path}")
            
            # Detect MIME type for better upload handling
            mime_type = self._detect_mime_type(video_path)
            
            # Upload the video file to Gemini
            upload_result = self.gemini_api.upload_file(video_path, mime_type)
            
            if not upload_result['success']:
                return {
                    'success': False,
                    'error': f"Failed to upload video: {upload_result['error']}"
                }
            
            uploaded_file = upload_result['data']
            
            # Wait for file to be processed
            if not self._wait_for_file_active(uploaded_file.name):
                return {
                    'success': False,
                    'error': "File upload failed or timed out"
                }
            
            # Generate summary
            summary_result = self._generate_summary(uploaded_file, platform)
            
            if not summary_result['success']:
                return summary_result
            
            return {
                'success': True,
                'summary': summary_result['summary'],
                'method': 'file_upload'
            }
            
        except Exception as e:
            logger.error(f"Error summarizing video file: {str(e)}")
            return {
                'success': False,
                'error': f"Failed to generate summary: {str(e)}"
            }
        finally:
            # Clean up the uploaded file
            if uploaded_file:
                self._cleanup_uploaded_file(uploaded_file.name)
    
    def summarize_youtube_video_direct(self, youtube_url: str) -> Dict[str, Any]:
        """
        Try to summarize YouTube video directly using URL
        
        Args:
            youtube_url: YouTube video URL
            
        Returns:
            Summarization result
        """
        try:
            logger.info(f"Attempting direct YouTube video summarization: {youtube_url}")
            
            # Create content for direct URL processing
            contents = types.Content(
                parts=[
                    types.Part(
                        file_data=types.FileData(file_uri=youtube_url)
                    ),
                    types.Part(
                        text=self._get_summary_prompt("YouTube")
                    )
                ]
            )
            
            # Try direct summarization
            result = self.gemini_api.generate_content('models/gemini-2.0-flash-exp', contents)
            
            if not result['success']:
                return {
                    'success': False,
                    'error': f"Direct YouTube summarization failed: {result['error']}"
                }
            
            return {
                'success': True,
                'summary': result['data'].text,
                'method': 'youtube_direct'
            }
            
        except Exception as e:
            logger.error(f"Error in direct YouTube summarization: {str(e)}")
            return {
                'success': False,
                'error': f"Direct YouTube summarization failed: {str(e)}"
            }
    
    def _wait_for_file_active(self, file_name: str, max_wait_seconds: int = 120) -> bool:
        """
        Wait for uploaded file to be in ACTIVE state
        
        Args:
            file_name: Name of the uploaded file
            max_wait_seconds: Maximum time to wait
            
        Returns:
            True if file becomes active, False otherwise
        """
        start_time = time.time()
        
        while time.time() - start_time < max_wait_seconds:
            try:
                status_result = self.gemini_api.get_file_status(file_name)
                
                if not status_result['success']:
                    logger.error(f"Error checking file status: {status_result['error']}")
                    return False
                
                file_info = status_result['data']
                
                if file_info.state == 'ACTIVE':
                    logger.info(f"File {file_name} is now active")
                    return True
                elif file_info.state == 'FAILED':
                    logger.error(f"File {file_name} failed to process")
                    return False
                
                logger.info(f"File {file_name} state: {file_info.state}, waiting...")
                time.sleep(2)
                
            except Exception as e:
                logger.error(f"Error checking file status: {str(e)}")
                return False
        
        logger.error(f"File {file_name} did not become active within {max_wait_seconds} seconds")
        return False
    
    def _generate_summary(self, uploaded_file, platform: str) -> Dict[str, Any]:
        """
        Generate summary for uploaded file
        
        Args:
            uploaded_file: Uploaded file object
            platform: Platform the video came from
            
        Returns:
            Summary generation result
        """
        try:
            # Create content for summarization
            contents = types.Content(
                parts=[
                    types.Part(file_data=types.FileData(file_uri=uploaded_file.uri)),
                    types.Part(text=self._get_summary_prompt(platform))
                ]
            )
            
            # Generate summary
            result = self.gemini_api.generate_content('models/gemini-2.0-flash-exp', contents)
            
            if not result['success']:
                return {
                    'success': False,
                    'error': f"Summary generation failed: {result['error']}"
                }
            
            return {
                'success': True,
                'summary': result['data'].text
            }
            
        except Exception as e:
            logger.error(f"Error generating summary: {str(e)}")
            return {
                'success': False,
                'error': f"Summary generation failed: {str(e)}"
            }
    
    def _get_summary_prompt(self, platform: str) -> str:
        """
        Get platform-specific summary prompt
        
        Args:
            platform: Platform the video came from
            
        Returns:
            Summary prompt text
        """
        return f"""Please provide a comprehensive summary of this {platform} video including:
        1. Main topic and key points discussed
        2. Important insights or takeaways
        3. Any actionable advice or recommendations
        4. Visual elements or context that might be important
        5. Target audience or context
        
        Format the response in a clear, structured way."""
    
    def _detect_mime_type(self, file_path: str) -> str:
        """
        Detect MIME type for video file
        
        Args:
            file_path: Path to the video file
            
        Returns:
            MIME type string
        """
        mime_type, _ = mimetypes.guess_type(file_path)
        
        if not mime_type or not mime_type.startswith('video/'):
            mime_type = 'video/mp4'  # Default fallback
        
        return mime_type
    
    def _cleanup_uploaded_file(self, file_name: str):
        """
        Clean up uploaded file from Gemini
        
        Args:
            file_name: Name of the file to delete
        """
        try:
            result = self.gemini_api.delete_file(file_name)
            if result['success']:
                logger.info(f"Cleaned up uploaded file: {file_name}")
            else:
                logger.warning(f"Failed to cleanup uploaded file: {result['error']}")
        except Exception as cleanup_error:
            logger.warning(f"Failed to cleanup uploaded file: {cleanup_error}") 