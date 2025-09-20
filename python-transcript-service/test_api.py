import pytest
import json
from app import create_app
from config import Config

@pytest.fixture
def client():
    """Create test client"""
    app = create_app()
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

@pytest.fixture
def auth_headers():
    """Get auth headers for testing"""
    config = Config()
    if config.has_api_keys:
        return {
            'X-API-Key': config.API_KEYS[0],
            'Content-Type': 'application/json'
        }
    return {'Content-Type': 'application/json'}
class TestYouTubeEndpoints:
    """Test YouTube-specific endpoints"""

    def test_youtube_transcript_working_video(self, client, auth_headers):
        """Test YouTube transcript with a known working video"""
        if 'X-API-Key' not in auth_headers:
            pytest.skip("No API keys configured")
            
        response = client.post('/transcript/youtube',
                             headers=auth_headers,
                             json={'url': 'https://www.youtube.com/watch?v=-_6dHIPVoTM'})
        
        assert response.status_code == 200
        data = json.loads(response.data)
        
        # Basic assertions for successful response
        assert data['success'] == True
        assert data['platform'] == 'youtube'
        assert data['videoId'] == '-_6dHIPVoTM'
        assert 'transcript' in data
        assert len(data['transcript']) > 0
        assert 'wordCount' in data
        assert data['wordCount'] > 0
        assert data['method'] == 'youtube_api'  # Should be either 'youtube_api' or 'audio_transcription'

    def test_youtube_transcript_fallback_system(self, client, auth_headers):
        """Test YouTube transcript fallback system with video that has no transcript"""
        if 'X-API-Key' not in auth_headers:
            pytest.skip("No API keys configured")
            
        # This video doesn't have a YouTube transcript, so it should use audio transcription
        response = client.post('/transcript/youtube',
                             headers=auth_headers,
                             json={'url': 'https://www.youtube.com/watch?v=SX-ZzkZyS24'})
        
        assert response.status_code == 200
        data = json.loads(response.data)
        
        # Basic assertions for successful response
        assert data['success'] == True
        assert data['platform'] == 'youtube'
        assert data['videoId'] == 'SX-ZzkZyS24'
        assert 'transcript' in data
        assert len(data['transcript']) > 0
        assert 'wordCount' in data
        assert data['wordCount'] > 0
        
        # This should specifically test the fallback system
        assert data['method'] == 'audio_transcription'  # Should use fallback method
        assert 'confidence' in data  # Audio transcription includes confidence score
        assert data['confidence'] > 0.9  # Should have high confidence
        assert 'title' in data  # Should include video title
        assert 'duration' in data  # Should include video duration
        
        # Verify the transcript content makes sense (basic sanity check)
        transcript_lower = data['transcript'].lower()
        assert 'hangzhou' in transcript_lower or 'china' in transcript_lower  # Video is about Hangzhou, China
        assert data['method'] == 'audio_transcription'

    def test_youtube_ask_gemini_working_video(self, client, auth_headers):
        """Test YouTube Gemini with a known working video"""
        if 'X-API-Key' not in auth_headers:
            pytest.skip("No API keys configured")
            
        response = client.post('/ask_gemini/youtube',
                             headers=auth_headers,
                             json={'url': 'https://www.youtube.com/watch?v=-_6dHIPVoTM'})
        
        # Should return 200 if Gemini is configured, 400 if not
        assert response.status_code in [200, 400]
        
        data = json.loads(response.data)
        if response.status_code == 200:
            assert data['success'] == True
            assert data['platform'] == 'youtube'
            assert 'response' in data
            assert 'method' in data
        else:
            assert 'error' in data
            assert 'Gemini' in data['error']
