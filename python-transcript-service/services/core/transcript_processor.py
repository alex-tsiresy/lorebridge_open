import re
import logging
from typing import Dict, Any, Optional
from services.external.youtube_transcript_api import YouTubeTranscriptAPI
from services.external.deepgram_api import DeepgramAPI

logger = logging.getLogger(__name__)

class TranscriptProcessor:
    """Core business logic for transcript processing"""
    
    def __init__(self, youtube_api: YouTubeTranscriptAPI, deepgram_api: Optional[DeepgramAPI] = None):
        """
        Initialize transcript processor
        
        Args:
            youtube_api: YouTube Transcript API instance
            deepgram_api: Optional Deepgram API instance for fallback
        """
        self.youtube_api = youtube_api
        self.deepgram_api = deepgram_api
    
    def get_youtube_transcript(self, video_id: str) -> Dict[str, Any]:
        """
        Get YouTube transcript with intelligent error handling and processing
        
        Args:
            video_id: YouTube video ID
            
        Returns:
            Processed transcript with metadata
        """
        try:
            # Try to get transcript from YouTube API
            result = self.youtube_api.fetch_transcript(video_id)
            
            if not result['success']:
                # Analyze the error and decide on retry strategy
                error_analysis = self._analyze_youtube_error(result['error'])
                
                return {
                    'success': False,
                    'error': error_analysis['user_message'],
                    'retry_with_audio': error_analysis['should_retry_with_audio'],
                    'error_type': error_analysis['error_type']
                }
            
            # Process the successful transcript
            processed_transcript = self._process_youtube_transcript(result['data'])
            
            return {
                'success': True,
                'transcript': processed_transcript['text'],
                'word_count': processed_transcript['word_count'],
                'segment_count': processed_transcript['segment_count'],
                'language': processed_transcript['language'],
                'language_code': processed_transcript['language_code'],
                'is_generated': processed_transcript['is_generated'],
                'method': 'youtube_api'
            }
            
        except Exception as e:
            logger.error(f"Unexpected error in transcript processing: {str(e)}")
            return {
                'success': False,
                'error': 'Unexpected error in transcript processing',
                'retry_with_audio': True,
                'error_type': 'unexpected_error'
            }
    
    def process_deepgram_transcript(self, audio_file_path: str) -> Dict[str, Any]:
        """
        Process audio transcript using Deepgram with intelligent analysis
        
        Args:
            audio_file_path: Path to the audio file
            
        Returns:
            Processed transcript with metadata
        """
        try:
            if not self.deepgram_api:
                logger.error("Deepgram API not configured")
                return {
                    'success': False,
                    'error': 'Deepgram API not configured'
                }
            
            # Add debug logging
            logger.info(f"Starting Deepgram transcription for file: {audio_file_path}")
            
            # Check if the file exists
            import os
            if not os.path.exists(audio_file_path):
                logger.error(f"Audio file does not exist: {audio_file_path}")
                return {
                    'success': False,
                    'error': f'Audio file does not exist: {audio_file_path}'
                }
            
            # Check file size
            file_size = os.path.getsize(audio_file_path)
            logger.info(f"Audio file size: {file_size} bytes")
            
            # Transcribe the audio
            logger.info("Calling Deepgram API for transcription...")
            result = self.deepgram_api.transcribe_audio_file(audio_file_path)
            
            if not result['success']:
                logger.error(f"Deepgram API failed with error: {result['error']}")
                return {
                    'success': False,
                    'error': f"Deepgram transcription failed: {result['error']}"
                }
            
            logger.info("Deepgram transcription successful, processing response...")
            
            # Process the successful transcript
            processed_transcript = self._process_deepgram_response(result['data'])
            
            logger.info(f"Processed transcript: {processed_transcript['word_count']} words, confidence: {processed_transcript['confidence']}")
            
            return {
                'success': True,
                'transcript': processed_transcript['text'],
                'word_count': processed_transcript['word_count'],
                'confidence': processed_transcript['confidence'],
                'detected_language': processed_transcript['detected_language'],
                'method': 'deepgram_api'
            }
            
        except Exception as e:
            logger.error(f"Unexpected error in Deepgram processing: {str(e)}")
            return {
                'success': False,
                'error': f"Deepgram processing failed: {str(e)}"
            }
    
    def _analyze_youtube_error(self, error_message: str) -> Dict[str, Any]:
        """
        Analyze YouTube API error and determine appropriate response
        
        Args:
            error_message: Error message from YouTube API
            
        Returns:
            Error analysis with user message and retry strategy
        """
        error_msg = error_message.lower()
        
        # Log the original error for debugging
        logger.info(f"Analyzing YouTube API error: {error_message}")
        
        if "too many requests" in error_msg or "429" in error_msg:
            logger.info("Error analysis: Rate limit detected, will retry with audio")
            return {
                'error_type': 'rate_limit',
                'user_message': 'YouTube API rate limit exceeded',
                'should_retry_with_audio': True
            }
        elif "transcript" in error_msg and ("not available" in error_msg or "disabled" in error_msg):
            logger.info("Error analysis: No transcript available, will retry with audio")
            return {
                'error_type': 'no_transcript',
                'user_message': 'No transcript available for this video',
                'should_retry_with_audio': True
            }
        elif "video unavailable" in error_msg or "private" in error_msg:
            logger.info("Error analysis: Video unavailable or private, will retry with audio")
            return {
                'error_type': 'video_unavailable',
                'user_message': 'Video is unavailable or private',
                'should_retry_with_audio': True
            }
        elif "could not retrieve" in error_msg or "could not fetch" in error_msg:
            logger.info("Error analysis: Retrieval failed, will retry with audio")
            return {
                'error_type': 'retrieval_failed',
                'user_message': 'Could not retrieve transcript from YouTube',
                'should_retry_with_audio': True
            }
        else:
            logger.info(f"Error analysis: Unknown error type, will retry with audio. Original error: {error_message}")
            return {
                'error_type': 'unknown',
                'user_message': f'YouTube API error: {error_message}',
                'should_retry_with_audio': True
            }
    
    def _process_youtube_transcript(self, transcript_result) -> Dict[str, Any]:
        """
        Process raw YouTube transcript data into clean format
        
        Args:
            transcript_result: Raw transcript result from YouTube API (list of transcript entries)
            
        Returns:
            Processed transcript data
        """
        # transcript_result is a list of transcript entries
        # Each entry has: {'text': 'transcript text', 'start': 0.0, 'duration': 4.0}
        
        if not transcript_result or not isinstance(transcript_result, list):
            logger.warning("Invalid transcript result format")
            return {
                'text': '',
                'word_count': 0,
                'segment_count': 0,
                'language': 'unknown',
                'language_code': 'unknown',
                'is_generated': False
            }
        
        # Extract transcript text from entries
        transcript_text = ' '.join([entry.get('text', '') for entry in transcript_result])
        
        # Clean up the text
        transcript_text = re.sub(r'\s+', ' ', transcript_text).strip()
        
        # Calculate word count
        word_count = len(transcript_text.split()) if transcript_text else 0
        
        # Try to detect if transcript is auto-generated (usually has more formatting issues)
        is_generated = any('[' in entry.get('text', '') and ']' in entry.get('text', '') for entry in transcript_result)
        
        return {
            'text': transcript_text,
            'word_count': word_count,
            'segment_count': len(transcript_result),
            'language': 'unknown',  # YouTube API doesn't always provide language info
            'language_code': 'unknown',
            'is_generated': is_generated
        }
    
    def _process_deepgram_response(self, deepgram_response) -> Dict[str, Any]:
        """
        Process raw Deepgram response into clean format
        
        Args:
            deepgram_response: Raw response from Deepgram API
            
        Returns:
            Processed transcript data
        """
        transcript_text = ""
        word_count = 0
        confidence = 0
        detected_language = None
        
        if deepgram_response.results and deepgram_response.results.channels:
            channel = deepgram_response.results.channels[0]
            alternatives = channel.alternatives
            
            if alternatives:
                transcript_text = alternatives[0].transcript
                word_count = len(transcript_text.split()) if transcript_text else 0
                confidence = alternatives[0].confidence if hasattr(alternatives[0], 'confidence') else 0
        
        # Check for detected language
        if hasattr(deepgram_response.results, 'metadata') and deepgram_response.results.metadata:
            detected_language = getattr(deepgram_response.results.metadata, 'detected_language', None)
        
        return {
            'text': transcript_text,
            'word_count': word_count,
            'confidence': confidence,
            'detected_language': detected_language
        } 