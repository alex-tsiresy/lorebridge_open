import logging
import os
from typing import Dict, Any
from services.core.transcript_processor import TranscriptProcessor
from services.core.media_downloader import MediaDownloader

logger = logging.getLogger(__name__)

class TranscriptWorkflow:
    """Orchestrates the complete transcript workflow"""
    
    def __init__(self, transcript_processor: TranscriptProcessor, media_downloader: MediaDownloader):
        """
        Initialize transcript workflow
        
        Args:
            transcript_processor: Core transcript processor
            media_downloader: Core media downloader
        """
        self.transcript_processor = transcript_processor
        self.media_downloader = media_downloader
    
    def get_transcript(self, url: str, video_id: str = None, platform: str = "youtube") -> Dict[str, Any]:
        """
        Complete transcript workflow with fallback strategy
        
        Args:
            url: Video URL
            video_id: Optional video ID for YouTube
            platform: Platform type (youtube, instagram, etc.)
            
        Returns:
            Complete transcript result
        """
        try:
            logger.info(f"Starting transcript workflow for {platform} URL: {url}")
            
            # Step 1: Try YouTube transcript API first (if it's YouTube)
            if platform == "youtube" and video_id:
                youtube_result = self.transcript_processor.get_youtube_transcript(video_id)
                
                if youtube_result['success']:
                    logger.info("Successfully got transcript from YouTube API")
                    return self._format_response(youtube_result, url, video_id, platform)
                
                # Log the actual error details for debugging
                error_message = youtube_result.get('error', 'Unknown error')
                error_type = youtube_result.get('error_type', 'unknown')
                logger.warning(f"YouTube API failed: {error_message} (Error type: {error_type})")
                
                # Check if we should retry with audio
                if not youtube_result.get('retry_with_audio', False):
                    logger.info("YouTube API failed and audio retry not recommended")
                    return self._format_error_response(youtube_result, url, video_id, platform)
                
                logger.info("YouTube API failed, falling back to audio transcription")
            
            # Step 2: Fallback to audio transcription
            audio_result = self._transcribe_via_audio(url, platform)
            
            if audio_result['success']:
                logger.info("Successfully transcribed via audio")
                return self._format_response(audio_result, url, video_id, platform)
            
            # Step 3: All methods failed
            logger.error("All transcript methods failed")
            return self._format_error_response(audio_result, url, video_id, platform)
            
        except Exception as e:
            logger.error(f"Unexpected error in transcript workflow: {str(e)}")
            return {
                'success': False,
                'error': f"Transcript workflow failed: {str(e)}",
                'url': url,
                'platform': platform
            }
    
    def _transcribe_via_audio(self, url: str, platform: str) -> Dict[str, Any]:
        """
        Transcribe video via audio download and processing
        
        Args:
            url: Video URL
            platform: Platform type
            
        Returns:
            Audio transcription result
        """
        temp_audio_file = None
        
        try:
            # Download audio
            download_result = self.media_downloader.download_audio(url, platform)
            
            if not download_result['success']:
                return {
                    'success': False,
                    'error': "Failed to download audio",
                    'details': download_result.get('error', 'Unknown error')
                }
            
            temp_audio_file = download_result['file_path']
            
            logger.info(f"Audio downloaded successfully: {download_result.get('title', 'Unknown')}")
            
            # Check file size before transcription
            file_size = os.path.getsize(temp_audio_file)
            file_size_mb = file_size / (1024 * 1024)  # Convert to MB
            
            logger.info(f"Audio file size: {file_size_mb:.2f} MB")
            
            # Warn if file is very large (over 50MB)
            if file_size_mb > 50:
                logger.warning(f"Large audio file ({file_size_mb:.2f} MB) - transcription may take longer")
            
            # Skip transcription if file is too large (over 100MB)
            if file_size_mb > 100:
                logger.error(f"Audio file too large ({file_size_mb:.2f} MB) - skipping transcription")
                return {
                    'success': False,
                    'error': f"Audio file too large ({file_size_mb:.2f} MB) - maximum size is 100MB",
                    'details': "Try with a shorter video or contact support"
                }
            
            # Transcribe audio
            transcription_result = self.transcript_processor.process_deepgram_transcript(temp_audio_file)
            
            if not transcription_result['success']:
                return {
                    'success': False,
                    'error': "Failed to transcribe audio",
                    'details': transcription_result.get('error', 'Unknown error')
                }
            
            # Combine download and transcription metadata
            return {
                'success': True,
                'transcript': transcription_result['transcript'],
                'word_count': transcription_result['word_count'],
                'confidence': transcription_result.get('confidence', 0),
                'method': 'audio_transcription',
                'title': download_result.get('title', 'Unknown'),
                'duration': download_result.get('duration', 0),
                'download_method': download_result.get('method', 'unknown'),
                'file_size_mb': file_size_mb
            }
            
        except Exception as e:
            logger.error(f"Audio transcription workflow error: {str(e)}")
            return {
                'success': False,
                'error': f"Audio transcription failed: {str(e)}"
            }
        finally:
            # Clean up temporary audio file
            if temp_audio_file and os.path.exists(temp_audio_file):
                try:
                    os.unlink(temp_audio_file)
                    logger.info("Temporary audio file cleaned up")
                except Exception as e:
                    logger.warning(f"Failed to clean up temporary file: {str(e)}")
    
    def _format_response(self, result: Dict[str, Any], url: str, video_id: str, platform: str) -> Dict[str, Any]:
        """
        Format successful response with consistent structure
        
        Args:
            result: Processing result
            url: Original URL
            video_id: Video ID if available
            platform: Platform type
            
        Returns:
            Formatted response
        """
        response = {
            'success': True,
            'transcript': result['transcript'],
            'word_count': result['word_count'],
            'platform': platform,
            'method': result['method'],
            'url': url
        }
        
        # Add optional fields if present
        if video_id:
            response['video_id'] = video_id
        
        if 'title' in result:
            response['title'] = result['title']
        
        if 'duration' in result:
            response['duration'] = result['duration']
        
        if 'confidence' in result:
            response['confidence'] = result['confidence']
        
        if 'language' in result:
            response['language'] = result['language']
        
        if 'language_code' in result:
            response['language_code'] = result['language_code']
        
        if 'segment_count' in result:
            response['segment_count'] = result['segment_count']
        
        if 'download_method' in result:
            response['download_method'] = result['download_method']
        
        return response
    
    def _format_error_response(self, result: Dict[str, Any], url: str, video_id: str, platform: str) -> Dict[str, Any]:
        """
        Format error response with consistent structure
        
        Args:
            result: Processing result with error
            url: Original URL
            video_id: Video ID if available
            platform: Platform type
            
        Returns:
            Formatted error response
        """
        response = {
            'success': False,
            'error': result.get('error', 'Unknown error'),
            'platform': platform,
            'url': url
        }
        
        # Add optional fields if present
        if video_id:
            response['video_id'] = video_id
        
        if 'details' in result:
            response['details'] = result['details']
        
        if 'error_type' in result:
            response['error_type'] = result['error_type']
        
        return response 