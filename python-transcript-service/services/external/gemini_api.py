import logging
from typing import Dict, Any
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

class GeminiAPI:
    """Pure API wrapper for Google Gemini API - just the raw API calls"""
    
    def __init__(self, api_key: str):
        """
        Initialize the Gemini API wrapper
        
        Args:
            api_key: Google Gemini API key
        """
        self.client = genai.Client(api_key=api_key)
    
    def generate_content(self, model: str, contents: types.Content) -> Dict[str, Any]:
        """
        Generate content using Gemini API - raw API call only
        
        Args:
            model: Gemini model name
            contents: Content to process
            
        Returns:
            Raw API response wrapped in success/error format
        """
        try:
            response = self.client.models.generate_content(
                model=model,
                contents=contents
            )
            
            return {
                'success': True,
                'data': response
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'error_type': 'gemini_api_error'
            }
    
    def upload_file(self, file_path: str, mime_type: str = None) -> Dict[str, Any]:
        """
        Upload file to Gemini Files API - raw API call only
        
        Args:
            file_path: Path to the file to upload
            mime_type: MIME type of the file
            
        Returns:
            Raw API response wrapped in success/error format
        """
        try:
            config = {}
            if mime_type:
                config['mimeType'] = mime_type
            
            uploaded_file = self.client.files.upload(
                file=file_path,
                config=config
            )
            
            return {
                'success': True,
                'data': uploaded_file
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'error_type': 'gemini_upload_error'
            }
    
    def get_file_status(self, file_name: str) -> Dict[str, Any]:
        """
        Get file status from Gemini Files API - raw API call only
        
        Args:
            file_name: Name of the uploaded file
            
        Returns:
            Raw API response wrapped in success/error format
        """
        try:
            file_info = self.client.files.get(name=file_name)
            
            return {
                'success': True,
                'data': file_info
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'error_type': 'gemini_file_status_error'
            }
    
    def delete_file(self, file_name: str) -> Dict[str, Any]:
        """
        Delete file from Gemini Files API - raw API call only
        
        Args:
            file_name: Name of the file to delete
            
        Returns:
            Raw API response wrapped in success/error format
        """
        try:
            self.client.files.delete(name=file_name)
            
            return {
                'success': True,
                'data': {'message': 'File deleted successfully'}
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'error_type': 'gemini_delete_error'
            } 