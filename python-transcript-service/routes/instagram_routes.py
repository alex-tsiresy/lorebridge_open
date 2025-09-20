import logging
import os
from flask import Blueprint, request, jsonify
from config import Config
from utils.auth import require_api_key
from utils.url_helpers import is_instagram_url
from services.service_factory import service_factory

logger = logging.getLogger(__name__)
config = Config()

# Create Blueprint for Instagram routes
instagram_bp = Blueprint('instagram', __name__)

@instagram_bp.route('/transcript/instagram', methods=['POST'])
@require_api_key
def get_instagram_transcript():
    """Get transcript from Instagram video (without AI summary)"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "JSON data is required"}), 400
        
        url = data.get('url')
        
        if not url:
            return jsonify({"error": "Instagram URL is required (use 'url' field)"}), 400
        
        if not is_instagram_url(url):
            return jsonify({"error": "Must be a valid Instagram URL"}), 400
        
        if not service_factory.is_deepgram_available():
            return jsonify({
                "error": "Deepgram API key required for Instagram video transcription"
            }), 400
        
        logger.info(f"Processing Instagram video: {url}")
        
        # Use the new transcript workflow
        transcript_workflow = service_factory.get_transcript_workflow()
        result = transcript_workflow.get_transcript(url, None, "instagram")
        
        if result['success']:
            # Convert to expected response format
            response_data = {
                "transcript": result['transcript'],
                "wordCount": result['word_count'],
                "platform": "instagram",
                "method": result['method'],
                "url": url,
                "success": True
            }
            
            # Add optional fields if present
            if 'title' in result:
                response_data['title'] = result['title']
            if 'duration' in result:
                response_data['duration'] = result['duration']
            if 'confidence' in result:
                response_data['confidence'] = result['confidence']
            if 'download_method' in result:
                response_data['download_method'] = result['download_method']
            
            return jsonify(response_data)
        else:
            return jsonify({
                "error": result.get('error', 'Audio transcription failed'),
                "details": result.get('details', 'Unknown error')
            }), 500
        
    except Exception as e:
        logger.error(f"Instagram transcript error: {str(e)}")
        return jsonify({"error": f"Failed to process Instagram video: {str(e)}"}), 500

@instagram_bp.route('/ask_gemini/instagram', methods=['POST'])
@require_api_key
def ask_gemini_instagram():
    """Ask Gemini AI questions about an Instagram video"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "JSON data is required"}), 400
        
        url = data.get('url')
        question = data.get('question')
        
        if not url:
            return jsonify({"error": "Instagram URL is required (use 'url' field)"}), 400
        
        if not is_instagram_url(url):
            return jsonify({"error": "Must be a valid Instagram URL"}), 400
        
        if not service_factory.is_gemini_available():
            return jsonify({"error": "Gemini API not configured"}), 400
        
        logger.info(f"Processing Gemini request for Instagram video: {url}")
        
        # Use the new video workflow
        video_workflow = service_factory.get_video_workflow()
        
        # If no specific question, provide a summary
        if not question:
            result = video_workflow.summarize_video_from_url(url, "instagram")
            
            if result['success']:
                return jsonify({
                    "success": True,
                    "platform": "instagram",
                    "url": url,
                    "response": result['summary'],
                    "method": result['method'],
                    "type": "summary"
                })
            else:
                return jsonify({
                    "error": result.get('error', 'Failed to generate summary')
                }), 500
        
        # Handle specific question (for future implementation)
        # For now, we'll treat it as a custom summary request
        logger.info(f"Custom question for Instagram video: {question}")
        
        # This is a placeholder for future custom question handling
        # For now, we'll just return the standard summary
        result = video_workflow.summarize_video_from_url(url, "instagram")
        
        if result['success']:
            return jsonify({
                "success": True,
                "platform": "instagram",
                "url": url,
                "question": question,
                "response": result['summary'],
                "method": result['method'],
                "type": "custom_question",
                "note": "Custom questions not yet implemented - returning standard summary"
            })
        else:
            return jsonify({
                "error": result.get('error', 'Failed to generate response')
            }), 500
        
    except Exception as e:
        logger.error(f"Instagram Gemini error: {str(e)}")
        return jsonify({"error": f"Failed to process Gemini request: {str(e)}"}), 500 