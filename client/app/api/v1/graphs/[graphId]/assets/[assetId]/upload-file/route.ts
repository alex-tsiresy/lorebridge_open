import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
// Configure larger body size limit for file uploads (20MB)
export const maxDuration = 60; // 60 seconds timeout for large uploads
import { auth } from '@clerk/nextjs/server';
import { logger } from '@/lib/logger';

const originHost = (() => {
  const o = (process.env.API_ORIGIN || '').trim();
  try { return new URL(o).host; } catch { return ''; }
})();

const allowedHosts = new Set([originHost, 'localhost:8000']);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ graphId: string; assetId: string }> }
) {
  try {
    // Get the authentication token
    const { getToken } = await auth();
    const token = await getToken?.();
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { graphId, assetId } = await params;

    // Get the form data from the request
    const formData = await request.formData();
    
    // Construct the backend URL
    const { getServerApiOrigin } = await import('@/lib/apiBase');
    const backendUrl = getServerApiOrigin({ allowLocalhost: true });
    const backendUploadUrl = `${backendUrl}/api/v1/graphs/${graphId}/assets/${assetId}/upload-file`;

    // SSRF protection: allow-list upstream hosts
    const upstream = new URL(backendUploadUrl);
    if (!allowedHosts.has(upstream.host)) {
      return NextResponse.json({ error: 'Upstream host not allowed' }, { status: 400 });
    }

    // Forward the request to the backend with authentication
    const response = await fetch(upstream, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        // Don't set Content-Type - let fetch set it with proper boundary for multipart/form-data
      },
      body: formData, // Forward the FormData directly
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Backend file upload error:', response.status, errorText);
      return NextResponse.json(
        { error: 'File upload failed' }, 
        { status: response.status }
      );
    }

    // Return the JSON response from backend
    const result = await response.json();
    return NextResponse.json(result);

  } catch (error) {
    logger.error('Error in file upload route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}