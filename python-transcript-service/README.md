# Enhanced Transcript Service

A Flask-based service that provides transcript extraction and AI-powered video summarization from YouTube and Instagram videos with multiple fallback strategies.

## Features

- **YouTube Transcript API**: Fast extraction of existing transcripts
- **Audio Download & Transcription**: Fallback using yt-dlp + Deepgram
- **Instagram Support**: Full support for Instagram video transcription
- **AI Video Summarization**: Intelligent video summaries using Google Gemini AI
- **Proxy Support**: Webshare residential proxies for reliability
- **API Authentication**: Secure access with API keys
- **Smart Fallback**: Automatic fallback from transcript API to audio transcription

## Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
# Webshare Proxy (Recommended for reliability)
WEBSHARE_USERNAME=your_username
WEBSHARE_PASSWORD=your_password

# Deepgram API (Required for audio transcription)
DEEPGRAM_API_KEY=your_deepgram_api_key

# Gemini API (Required for video summarization)
GEMINI_API_KEY=your_gemini_api_key

# API Security
API_KEYS=your_secure_api_key_1,your_secure_api_key_2

# Service Configuration
PORT=5001
```

### 3. Generate API Keys

```bash
python generate-api-keys.py
```

### 4. Start the Service

```bash
python app.py
```

## API Endpoints

### Health Check
```bash
GET /health
```
No authentication required. Returns service status.

### YouTube Transcript
```bash
POST /transcript/youtube
```
Get transcript from YouTube video (no AI summary).

**Request:**
```bash
curl -X POST http://localhost:5001/transcript/youtube \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key" \
  -d '{"url": "https://www.youtube.com/watch?v=VIDEO_ID"}'
```

### YouTube AI Summary
```bash
POST /ask_gemini/youtube
```
Get AI-powered summary of YouTube video.

**Request:**
```bash
curl -X POST http://localhost:5001/ask_gemini/youtube \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key" \
  -d '{"url": "https://www.youtube.com/watch?v=VIDEO_ID"}'
```

### Instagram Transcript
```bash
POST /transcript/instagram
```
Get transcript from Instagram video (no AI summary).

**Request:**
```bash
curl -X POST http://localhost:5001/transcript/instagram \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key" \
  -d '{"url": "https://www.instagram.com/p/POST_ID/"}'
```

### Instagram AI Summary
```bash
POST /ask_gemini/instagram
```
Get AI-powered summary of Instagram video.

**Request:**
```bash
curl -X POST http://localhost:5001/ask_gemini/instagram \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key" \
  -d '{"url": "https://www.instagram.com/p/POST_ID/"}'
```

## Response Format

### Transcript Response
```json
{
  "success": true,
  "transcript": "Full transcript text here...",
  "wordCount": 1250,
  "platform": "youtube",
  "method": "youtube_api",
  "title": "Video Title",
  "duration": 300,
  "confidence": 0.95,
  "videoId": "VIDEO_ID",
  "url": "https://www.youtube.com/watch?v=VIDEO_ID"
}
```

### AI Summary Response
```json
{
  "success": true,
  "platform": "youtube",
  "url": "https://www.youtube.com/watch?v=VIDEO_ID",
  "response": "AI-generated comprehensive summary...",
  "method": "youtube_direct",
  "type": "summary"
}
```

## How It Works

### YouTube Videos
1. **Transcript**: Uses YouTube's built-in transcript API (fastest)
2. **Fallback**: If transcript unavailable, downloads audio with yt-dlp and transcribes with Deepgram
3. **AI Summary**: Uses Google Gemini AI with direct YouTube URL processing

### Instagram Videos
1. **Transcript**: Downloads audio using yt-dlp and transcribes with Deepgram
2. **AI Summary**: Downloads video file and analyzes with Google Gemini AI

## Setup Guide

### Required API Keys

**Deepgram API Key** (Required for Instagram and audio fallback):
1. Sign up at [Deepgram Console](https://logger.deepgram.com/)
2. Create a new project and generate an API key
3. Add to your `.env` file

**Google Gemini API Key** (Required for AI video summarization):
1. Visit [Google AI Studio](https://ai.google.dev/)
2. Create a new project and generate an API key
3. Add to your `.env` file as `GEMINI_API_KEY`

**Webshare Proxy** (Recommended for reliability):
1. Sign up at [Webshare.io](https://www.webshare.io/)
2. Get your proxy credentials
3. Add to your `.env` file

## Supported Platforms

- **YouTube**: youtube.com, youtu.be, m.youtube.com
- **Instagram**: instagram.com (posts and reels)

## Deployment

### Docker
```bash
docker build -t transcript-service .
docker run -p 5001:5001 --env-file .env transcript-service
```

### Docker Compose
```bash
docker-compose up -d
```

## Configuration Tips

1. **Proxy Configuration**: Use Webshare residential proxies for best reliability
2. **API Keys**: Generate long, secure API keys for production
3. **Deepgram**: Required for Instagram and audio transcription fallback
4. **Gemini**: Required for AI video summarization features

## Troubleshooting

### Common Issues

1. **"Deepgram API key required"**: Add `DEEPGRAM_API_KEY` to `.env`
2. **"Gemini API not configured"**: Add `GEMINI_API_KEY` to `.env`
3. **Rate limits**: Configure Webshare proxy credentials
4. **Audio download fails**: Check network connectivity and proxy settings

### Debug Mode
Set `debug=True` in `app.run()` for detailed logging.

## License

MIT License