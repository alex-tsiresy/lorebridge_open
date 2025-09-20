import logging
import os
from typing import Dict, Any
from services.core.media_downloader import MediaDownloader
from services.core.video_summarizer import VideoSummarizer

logger = logging.getLogger(__name__)

class VideoWorkflow:
    """Orchestrates the complete video processing workflow"""
    
    def __init__(self, media_downloader: MediaDownloader, video_summarizer: VideoSummarizer):
        """
        Initialize video workflow
        
        Args:
            media_downloader: Core media downloader
            video_summarizer: Core video summarizer
        """
        self.media_downloader = media_downloader
        self.video_summarizer = video_summarizer
    
    def download_video_only(self, url: str, platform: str = "youtube") -> Dict[str, Any]:
        """
        Download video without further processing
        
        Args:
            url: Video URL
            platform: Platform type (youtube, instagram, etc.)
            
        Returns:
            Download result
        """
        try:
            logger.info(f"Starting video download workflow for {platform} URL: {url}")
            
            # Download video
            download_result = self.media_downloader.download_video(url, platform)
            
            if not download_result['success']:
                return {
                    'success': False,
                    'error': "Failed to download video",
                    'details': download_result.get('error', 'Unknown error'),
                    'url': url,
                    'platform': platform
                }
            
            logger.info(f"Video downloaded successfully: {download_result.get('title', 'Unknown')}")
            
            return {
                'success': True,
                'message': f"Video downloaded successfully to: {download_result['file_path']}",
                'video_path': download_result['file_path'],
                'title': download_result.get('title', 'Unknown'),
                'duration': download_result.get('duration', 0),
                'file_size': download_result.get('file_size', 0),
                'method': download_result.get('method', 'unknown'),
                'platform': platform,
                'url': url
            }
            
        except Exception as e:
            logger.error(f"Video download workflow error: {str(e)}")
            return {
                'success': False,
                'error': f"Video download failed: {str(e)}",
                'url': url,
                'platform': platform
            }
    
    def summarize_youtube_video(self, youtube_url: str) -> Dict[str, Any]:
        """
        Complete YouTube video summarization workflow
        
        Args:
            youtube_url: YouTube video URL
            
        Returns:
            Summarization result
        """
        try:
            logger.info(f"Starting YouTube video summarization workflow: {youtube_url}")
            
            # Step 1: Try direct YouTube URL summarization
            direct_result = self.video_summarizer.summarize_youtube_video_direct(youtube_url)
            
            if direct_result['success']:
                logger.info("Successfully summarized YouTube video directly")
                return self._format_summary_response(direct_result, youtube_url, "youtube")
            
            logger.info("Direct YouTube summarization failed, falling back to download + Files API")
            
            # Step 2: Fallback to download + Files API method
            download_result = self._summarize_via_download(youtube_url, "youtube")
            
            if download_result['success']:
                logger.info("Successfully summarized YouTube video via download")
                return self._format_summary_response(download_result, youtube_url, "youtube")
            
            # Step 3: All methods failed
            logger.error("All YouTube summarization methods failed")
            return {
                'success': False,
                'error': download_result.get('error', 'YouTube summarization failed'),
                'url': youtube_url,
                'platform': 'youtube'
            }
            
        except Exception as e:
            logger.error(f"YouTube summarization workflow error: {str(e)}")
            return {
                'success': False,
                'error': f"YouTube summarization failed: {str(e)}",
                'url': youtube_url,
                'platform': 'youtube'
            }
    
    def summarize_video_from_url(self, url: str, platform: str = "unknown") -> Dict[str, Any]:
        """
        Summarize video from any URL by downloading first
        
        Args:
            url: Video URL
            platform: Platform type
            
        Returns:
            Summarization result
        """
        try:
            logger.info(f"Starting video summarization workflow for {platform} URL: {url}")
            
            # Download and summarize
            result = self._summarize_via_download(url, platform)
            
            if result['success']:
                logger.info("Successfully summarized video")
                return self._format_summary_response(result, url, platform)
            
            logger.error("Video summarization failed")
            return {
                'success': False,
                'error': result.get('error', 'Video summarization failed'),
                'url': url,
                'platform': platform
            }
            
        except Exception as e:
            logger.error(f"Video summarization workflow error: {str(e)}")
            return {
                'success': False,
                'error': f"Video summarization failed: {str(e)}",
                'url': url,
                'platform': platform
            }
    
    def _summarize_via_download(self, url: str, platform: str) -> Dict[str, Any]:
        """
        Summarize video by downloading it first
        
        Args:
            url: Video URL
            platform: Platform type
            
        Returns:
            Summarization result
        """
        temp_video_file = None
        
        try:
            # Download video
            download_result = self.media_downloader.download_video(url, platform)
            
            if not download_result['success']:
                return {
                    'success': False,
                    'error': "Failed to download video for summarization",
                    'details': download_result.get('error', 'Unknown error')
                }
            
            temp_video_file = download_result['file_path']
            
            logger.info(f"Video downloaded for summarization: {download_result.get('title', 'Unknown')}")
            
            # Summarize video
            summary_result = self.video_summarizer.summarize_video_file(temp_video_file, platform)
            
            if not summary_result['success']:
                return {
                    'success': False,
                    'error': "Failed to summarize video",
                    'details': summary_result.get('error', 'Unknown error')
                }
            
            # Combine download and summarization metadata
            return {
                'success': True,
                'summary': summary_result['summary'],
                'method': f"{platform}_download_files_api",
                'video_title': download_result.get('title', 'Unknown'),
                'video_duration': download_result.get('duration', 0),
                'video_size': download_result.get('file_size', 0),
                'download_method': download_result.get('method', 'unknown')
            }
            
        except Exception as e:
            logger.error(f"Download and summarize workflow error: {str(e)}")
            return {
                'success': False,
                'error': f"Download and summarize failed: {str(e)}"
            }
        finally:
            # Clean up temporary video file
            if temp_video_file and os.path.exists(temp_video_file):
                try:
                    os.unlink(temp_video_file)
                    logger.info("Temporary video file cleaned up")
                except Exception as e:
                    logger.warning(f"Failed to clean up temporary file: {str(e)}")
    
    def _format_summary_response(self, result: Dict[str, Any], url: str, platform: str) -> Dict[str, Any]:
        """
        Format successful summary response with consistent structure
        
        Args:
            result: Summarization result
            url: Original URL
            platform: Platform type
            
        Returns:
            Formatted response
        """
        response = {
            'success': True,
            'summary': result['summary'],
            'method': result['method'],
            'platform': platform,
            'url': url
        }
        
        # Add optional fields if present
        if 'video_title' in result:
            response['video_title'] = result['video_title']
        
        if 'video_duration' in result:
            response['video_duration'] = result['video_duration']
        
        if 'video_size' in result:
            response['video_size'] = result['video_size']
        
        if 'download_method' in result:
            response['download_method'] = result['download_method']
        
        return response 