import logging
import time
from typing import Dict, Any
from deepgram import DeepgramClient, PrerecordedOptions

logger = logging.getLogger(__name__)

class DeepgramAPI:
    """Pure API wrapper for Deepgram API - just the raw API calls"""
    
    def __init__(self, api_key: str):
        """
        Initialize the Deepgram API wrapper
        
        Args:
            api_key: Deepgram API key
        """
        # Use standard Deepgram client as per official documentation
        self.client = DeepgramClient(api_key)
    
    def transcribe_audio_file(self, audio_file_path: str, options: PrerecordedOptions = None) -> Dict[str, Any]:
        """
        Transcribe audio file using Deepgram API with retry logic
        
        Args:
            audio_file_path: Path to the audio file
            options: Deepgram transcription options
            
        Returns:
            Raw API response wrapped in success/error format
        """
        max_retries = 3
        retry_delay = 5  # seconds
        
        for attempt in range(max_retries):
            try:
                logger.info(f"Deepgram API: Starting transcription attempt {attempt + 1}/{max_retries} for {audio_file_path}")
                
                if options is None:
                    options = PrerecordedOptions(
                        model="nova-2",
                        smart_format=True,
                        punctuate=True,
                        language="en",
                        detect_language=True,
                        utterances=False,  # Disable to reduce processing time
                        diarize=False,     # Disable to reduce processing time
                        filler_words=False,  # Disable to reduce processing time
                    )
                
                logger.info(f"Deepgram API: Using options - model: {options.model}, language: {options.language}")
                
                # Read the audio file as bytes
                logger.info(f"Deepgram API: Reading audio file...")
                with open(audio_file_path, 'rb') as audio_file:
                    buffer_data = audio_file.read()
                
                logger.info(f"Deepgram API: Read {len(buffer_data)} bytes from audio file")
                
                # Make the API call using the correct method from documentation
                logger.info("Deepgram API: Making API call to transcribe_file...")
                response = self.client.listen.prerecorded.v("1").transcribe_file(
                    {"buffer": buffer_data}, options
                )
                
                logger.info("Deepgram API: Transcription completed successfully")
                
                return {
                    'success': True,
                    'data': response
                }
                
            except Exception as e:
                error_msg = str(e)
                logger.error(f"Deepgram API: Attempt {attempt + 1} failed - {error_msg}")
                
                # Check if this is a retryable error
                is_retryable = (
                    "timeout" in error_msg.lower() or
                    "504" in error_msg or
                    "502" in error_msg or
                    "503" in error_msg or
                    "connection" in error_msg.lower() or
                    "network" in error_msg.lower()
                )
                
                # If it's the last attempt or not retryable, return error
                if attempt == max_retries - 1 or not is_retryable:
                    logger.error(f"Deepgram API: All attempts failed or error not retryable")
                    
                    # Provide more specific error messages based on common Deepgram errors
                    if "timeout" in error_msg.lower() or "504" in error_msg:
                        return {
                            'success': False,
                            'error': 'Deepgram API timeout - audio file may be too large or service is slow',
                            'error_type': 'timeout_error'
                        }
                    elif "rate" in error_msg.lower() or "429" in error_msg:
                        return {
                            'success': False,
                            'error': 'Deepgram API rate limit exceeded',
                            'error_type': 'rate_limit_error'
                        }
                    elif "413" in error_msg or "file too large" in error_msg.lower():
                        return {
                            'success': False,
                            'error': 'Audio file too large (max 2GB)',
                            'error_type': 'file_size_error'
                        }
                    else:
                        return {
                            'success': False,
                            'error': f'Deepgram API error: {error_msg}',
                            'error_type': 'deepgram_api_error'
                        }
                else:
                    # Wait before retrying
                    logger.info(f"Deepgram API: Waiting {retry_delay} seconds before retry...")
                    time.sleep(retry_delay)
                    retry_delay *= 2  # Exponential backoff 