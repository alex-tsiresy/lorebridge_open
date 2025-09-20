import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { auth } from '@clerk/nextjs/server';
import { logger } from '@/lib/logger';

const originHost = (() => {
  const o = (process.env.API_ORIGIN || '').trim();
  try { return new URL(o).host; } catch { return ''; }
})();

const allowedHosts = new Set([originHost, 'localhost:8000']);

export async function POST(request: NextRequest) {
  try {
    // Get the authentication token
    const { getToken } = await auth();
    const token = await getToken?.();
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get request body
    const body = await request.json();

    // Construct the backend URL
    const { getServerApiOrigin } = await import('@/lib/apiBase');
    const backendUrl = getServerApiOrigin({ allowLocalhost: true });
    const backendChatUrl = `${backendUrl}/api/v1/langchain-chat`;

    // SSRF protection: allow-list upstream hosts
    const upstream = new URL(backendChatUrl);
    if (!allowedHosts.has(upstream.host)) {
      return NextResponse.json({ error: 'Upstream host not allowed' }, { status: 400 });
    }

    // Forward the request to the backend with authentication
    const response = await fetch(upstream, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Backend error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Backend request failed' }, 
        { status: response.status }
      );
    }

    // Check if response has a body for streaming
    if (!response.body) {
      return NextResponse.json({ error: 'No response body from backend' }, { status: 500 });
    }

    // Create a streaming response that passes through the backend stream
    const stream = new ReadableStream({
      start(controller) {
        const reader = response.body!.getReader();

        function pump(): Promise<void> {
          return reader.read().then(({ done, value }) => {
            if (done) {
              controller.close();
              return;
            }
            
            // Pass through the raw bytes to maintain streaming format
            controller.enqueue(value);
            return pump();
          }).catch(error => {
            logger.error('Streaming error:', error);
            controller.error(error);
          });
        }

        return pump();
      },
      cancel() {
        // Clean up if the client cancels the request
        response.body?.cancel();
      }
    });

    // Return streaming response with appropriate headers
    return new NextResponse(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        // Prevent buffering in proxies
        'X-Accel-Buffering': 'no',
      },
    });

  } catch (error) {
    logger.error('Error in streaming chat route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}