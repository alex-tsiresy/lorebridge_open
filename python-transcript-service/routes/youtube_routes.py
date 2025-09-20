import logging
from flask import Blueprint, request, jsonify
from config import Config
from utils.auth import require_api_key
from utils.url_helpers import is_youtube_url, extract_video_id
from services.service_factory import service_factory

logger = logging.getLogger(__name__)
config = Config()

# Create Blueprint for YouTube routes
youtube_bp = Blueprint('youtube', __name__)

@youtube_bp.route('/transcript/youtube', methods=['POST'])
@require_api_key
def get_youtube_transcript():
    """Get transcript from YouTube video (without AI summary)"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "JSON data is required"}), 400
        
        url = data.get('url') or data.get('youtubeUrl')
        
        if not url:
            return jsonify({"error": "YouTube URL is required (use 'url' field)"}), 400
        
        if not is_youtube_url(url):
            return jsonify({"error": "Must be a valid YouTube URL"}), 400
        
        video_id = extract_video_id(url)
        if not video_id:
            return jsonify({"error": "Invalid YouTube URL"}), 400
        
        logger.info(f"Processing YouTube video ID: {video_id}")
        
        # Use the new transcript workflow
        transcript_workflow = service_factory.get_transcript_workflow()
        result = transcript_workflow.get_transcript(url, video_id, "youtube")
        
        if result['success']:
            # Convert to expected response format
            response_data = {
                "success": True,
                "transcript": result['transcript'],
                "word_count": result['word_count'],
                "videoId": video_id,
                "platform": "youtube",
                "url": url,
                "method": result['method']
            }
            
            # Add optional fields if present
            if 'title' in result:
                response_data['title'] = result['title']
            if 'duration' in result:
                response_data['duration'] = result['duration']
            if 'confidence' in result:
                response_data['confidence'] = result['confidence']
            if 'language' in result:
                response_data['language'] = result['language']
            if 'language_code' in result:
                response_data['language_code'] = result['language_code']
            if 'segment_count' in result:
                response_data['segment_count'] = result['segment_count']
            if 'is_generated' in result:
                response_data['is_generated'] = result['is_generated']
            
            return jsonify(response_data)
        else:
            return jsonify({
                "error": result.get('error', 'Failed to get transcript'),
                "details": result.get('details', 'Unknown error')
            }), 500
        
    except Exception as e:
        logger.error(f"YouTube transcript error: {str(e)}")
        return jsonify({"error": f"Failed to process YouTube video: {str(e)}"}), 500

@youtube_bp.route('/ask_gemini/youtube', methods=['POST'])
@require_api_key
def ask_gemini_youtube():
    """Ask Gemini AI to summarize a YouTube video"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "JSON data is required"}), 400
        
        url = data.get('url') or data.get('youtubeUrl')
        
        if not url:
            return jsonify({"error": "YouTube URL is required (use 'url' field)"}), 400
        
        if not is_youtube_url(url):
            return jsonify({"error": "Must be a valid YouTube URL"}), 400
        
        if not service_factory.is_gemini_available():
            return jsonify({"error": "Gemini API not configured"}), 400
        
        logger.info(f"Processing Gemini summary request for YouTube video: {url}")
        
        # Use the new video workflow
        video_workflow = service_factory.get_video_workflow()
        result = video_workflow.summarize_youtube_video(url)
        
        if result['success']:
            response_data = {
                "success": True,
                "platform": "youtube",
                "url": url,
                "response": result['summary'],
                "method": result['method'],
                "type": "summary"
            }
            
            # Add additional info if available
            if 'video_title' in result:
                response_data['video_title'] = result['video_title']
            if 'video_duration' in result:
                response_data['video_duration'] = result['video_duration']
            if 'video_size' in result:
                response_data['video_size'] = result['video_size']
            if 'download_method' in result:
                response_data['download_method'] = result['download_method']
            
            return jsonify(response_data)
        else:
            return jsonify({
                "error": result.get('error', 'Failed to generate summary')
            }), 500
        
    except Exception as e:
        logger.error(f"YouTube Gemini error: {str(e)}")
        return jsonify({"error": f"Failed to process Gemini request: {str(e)}"}), 500 