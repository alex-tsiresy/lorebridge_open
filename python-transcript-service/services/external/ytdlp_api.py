import logging
import yt_dlp
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class YtDlpAPI:
    """Pure API wrapper for yt-dlp - just the raw API calls"""
    
    def __init__(self, proxy_url: Optional[str] = None):
        """
        Initialize the yt-dlp API wrapper
        
        Args:
            proxy_url: Optional proxy URL for yt-dlp
        """
        self.proxy_url = proxy_url
    
    def extract_info(self, url: str, download: bool = True, extra_options: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Extract info/download from URL using yt-dlp - raw API call only
        
        Args:
            url: URL to process
            download: Whether to download or just extract info
            extra_options: Additional yt-dlp options
            
        Returns:
            Raw API response wrapped in success/error format
        """
        try:
            # Base options
            ydl_opts = {
                'no_warnings': True,
                'quiet': True,
            }
            
            # Add proxy if available
            if self.proxy_url:
                ydl_opts['proxy'] = self.proxy_url
            
            # Add extra options
            if extra_options:
                ydl_opts.update(extra_options)
            
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=download)
                
                return {
                    'success': True,
                    'data': info
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'error_type': 'ytdlp_error'
            }
    
    def download_audio(self, url: str, output_path: str, extra_options: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Download audio from URL using yt-dlp - raw API call only
        
        Args:
            url: URL to download from
            output_path: Path for the output file
            extra_options: Additional yt-dlp options
            
        Returns:
            Raw API response wrapped in success/error format
        """
        try:
            # Base options for audio download
            ydl_opts = {
                'format': 'bestaudio/best',
                'outtmpl': output_path.replace('.wav', '.%(ext)s'),
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'wav',
                    'preferredquality': '192',
                }],
                'no_warnings': True,
                'quiet': True,
                'keepvideo': False,
            }
            
            # Add proxy if available
            if self.proxy_url:
                ydl_opts['proxy'] = self.proxy_url
            
            # Add extra options
            if extra_options:
                ydl_opts.update(extra_options)
            
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                # Get info first
                info = ydl.extract_info(url, download=False)
                
                # Then download
                ydl.download([url])
                
                return {
                    'success': True,
                    'data': {
                        'info': info,
                        'output_path': output_path
                    }
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'error_type': 'ytdlp_download_error'
            }
    
    def download_video(self, url: str, output_path: str, extra_options: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Download video from URL using yt-dlp - raw API call only
        
        Args:
            url: URL to download from
            output_path: Path for the output file
            extra_options: Additional yt-dlp options
            
        Returns:
            Raw API response wrapped in success/error format
        """
        try:
            # Base options for video download
            ydl_opts = {
                'format': 'best[ext=mp4]/best',
                'outtmpl': output_path,
                'no_warnings': True,
                'quiet': True,
            }
            
            # Add proxy if available
            if self.proxy_url:
                ydl_opts['proxy'] = self.proxy_url
            
            # Add extra options
            if extra_options:
                ydl_opts.update(extra_options)
            
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                # Get info first
                info = ydl.extract_info(url, download=False)
                
                # Then download
                ydl.download([url])
                
                return {
                    'success': True,
                    'data': {
                        'info': info,
                        'output_path': output_path
                    }
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'error_type': 'ytdlp_video_download_error'
            } 