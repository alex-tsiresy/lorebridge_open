import os
import logging
import tempfile
import subprocess
from typing import Dict, Any
from services.external.ytdlp_api import YtDlpAPI

logger = logging.getLogger(__name__)

class MediaDownloader:
    """Core business logic for media downloading"""
    
    def __init__(self, ytdlp_api: YtDlpAPI):
        """
        Initialize media downloader
        
        Args:
            ytdlp_api: YT-DLP API instance
        """
        self.ytdlp_api = ytdlp_api
    
    def download_audio(self, url: str, platform: str) -> Dict[str, Any]:
        """
        Download audio from video URL with intelligent processing
        
        Args:
            url: Video URL
            platform: Platform type (youtube, instagram, etc.)
            
        Returns:
            Download result with metadata
        """
        temp_audio_file = None
        
        try:
            logger.info(f"Downloading audio from {platform} URL: {url}")
            
            # Create temporary file for audio download
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
                temp_audio_file = temp_file.name
            
            # Download audio using YT-DLP
            result = self.ytdlp_api.download_audio(url, temp_audio_file)
            
            if not result['success']:
                return {
                    'success': False,
                    'error': result.get('error', 'Unknown download error'),
                    'details': result.get('details', '')
                }
            
            # Check if file was actually created
            if not os.path.exists(temp_audio_file) or os.path.getsize(temp_audio_file) == 0:
                return {
                    'success': False,
                    'error': 'Downloaded audio file is empty or missing'
                }
            
            original_file = temp_audio_file
            
            # Compress audio to reduce file size for Deepgram
            compressed_file = self._compress_audio(original_file)
            
            if compressed_file:
                # Use compressed file and clean up original
                try:
                    os.unlink(original_file)
                    logger.info("Original audio file cleaned up after compression")
                except Exception as e:
                    logger.warning(f"Failed to clean up original file: {str(e)}")
                
                final_file = compressed_file
                compressed = True
                
                # Update file size info
                file_size = os.path.getsize(compressed_file)
                file_size_mb = file_size / (1024 * 1024)
                logger.info(f"Audio compressed to {file_size_mb:.2f} MB")
            else:
                logger.warning("Audio compression failed, using original file")
                final_file = original_file
                compressed = False
            
            # Extract metadata from the download result
            info = result['data']['info']
            
            return {
                'success': True,
                'file_path': final_file,
                'title': info.get('title', 'Unknown'),
                'duration': info.get('duration', 0),
                'platform': platform,
                'compressed': compressed,
                'method': 'ytdlp_download'
            }
            
        except Exception as e:
            logger.error(f"Media download error: {str(e)}")
            
            # Clean up temporary file on error
            if temp_audio_file and os.path.exists(temp_audio_file):
                try:
                    os.unlink(temp_audio_file)
                except:
                    pass
            
            return {
                'success': False,
                'error': f"Media download failed: {str(e)}"
            }
    
    def _compress_audio(self, input_file: str) -> str:
        """
        Compress audio file to reduce size for faster upload to Deepgram
        
        Args:
            input_file: Path to input audio file
            
        Returns:
            Path to compressed file, or None if compression failed
        """
        try:
            # Create temporary file for compressed audio
            with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as temp_file:
                output_file = temp_file.name
            
            # Use ffmpeg to compress audio
            # - Convert to MP3 with lower bitrate
            # - Mono audio (reduces file size by ~50%)
            # - 22kHz sample rate (sufficient for speech)
            cmd = [
                'ffmpeg',
                '-i', input_file,
                '-acodec', 'mp3',
                '-b:a', '64k',  # 64kbps bitrate (lower quality but much smaller)
                '-ac', '1',     # Mono audio
                '-ar', '22050', # 22kHz sample rate
                '-y',           # Overwrite output file
                output_file
            ]
            
            logger.info("Compressing audio for faster upload...")
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            
            if result.returncode == 0:
                # Check if compressed file exists and is smaller
                if os.path.exists(output_file):
                    original_size = os.path.getsize(input_file)
                    compressed_size = os.path.getsize(output_file)
                    
                    if compressed_size < original_size:
                        reduction = (1 - compressed_size / original_size) * 100
                        logger.info(f"Audio compression successful: {reduction:.1f}% size reduction")
                        return output_file
                    else:
                        logger.warning("Compressed file is not smaller, using original")
                        os.unlink(output_file)
                        return None
                else:
                    logger.warning("Compressed file was not created")
                    return None
            else:
                logger.warning(f"FFmpeg compression failed: {result.stderr}")
                return None
                
        except subprocess.TimeoutExpired:
            logger.warning("Audio compression timed out")
            return None
        except Exception as e:
            logger.warning(f"Audio compression error: {str(e)}")
            return None 