import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { auth } from '@clerk/nextjs/server';

const originHost = (() => {
  const o = (process.env.API_ORIGIN || '').trim();
  try { return new URL(o).host; } catch { return ''; }
})();

const allowedHosts = new Set([originHost, 'localhost:8000']);

export async function GET(
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

    // Construct the backend URL
    const { getServerApiOrigin } = await import('@/lib/apiBase');
    const backendUrl = getServerApiOrigin({ allowLocalhost: true });
    const backendFileUrl = `${backendUrl}/api/v1/graphs/${graphId}/assets/${assetId}/file`;

    // SSRF protection: allow-list upstream hosts
    const upstream = new URL(backendFileUrl);
    if (!allowedHosts.has(upstream.host)) {
      return NextResponse.json({ error: 'Upstream host not allowed' }, { status: 400 });
    }

    // Forward the request to the backend with authentication; support Range and validators
    const range = request.headers.get('range') || undefined;
    const ifNoneMatch = request.headers.get('if-none-match') || undefined;
    const ifModifiedSince = request.headers.get('if-modified-since') || undefined;
    const outboundHeaders: Record<string, string> = {};
    if (token) outboundHeaders['Authorization'] = `Bearer ${token}`;
    if (range) outboundHeaders['Range'] = range;
    if (ifNoneMatch) outboundHeaders['If-None-Match'] = ifNoneMatch;
    if (ifModifiedSince) outboundHeaders['If-Modified-Since'] = ifModifiedSince;

    const response = await fetch(upstream, {
      headers: outboundHeaders,
      method: 'GET',
      redirect: 'manual',
    });
    
    // If we got an error, log the response body
    if (!response.ok) {
      const errorText = await response.text();
      
      // Re-create the response since we consumed the body
      const errorResponse = new NextResponse(errorText, {
        status: response.status,
        statusText: response.statusText
      });
      
      return errorResponse;
    }

    // Stream body and pass through relevant headers, preserve status (e.g., 206, 304)
    const headers = new Headers();
    const passthroughKeys = [
      'content-type',
      'content-length',
      'cache-control',
      'etag',
      'content-disposition',
      'accept-ranges',
      'content-range',
      'last-modified',
      'access-control-allow-origin',
      'access-control-allow-methods',
      'access-control-allow-headers',
    ];
    for (const key of passthroughKeys) {
      const v = response.headers.get(key);
      if (v) {
        headers.set(key, v);
      }
    }
    // Default sensible cache if upstream omitted
    if (!headers.has('cache-control')) {
      headers.set('Cache-Control', 'public, max-age=3600');
    }
    
    // Ensure we have proper content-type for PDFs
    if (!headers.has('content-type')) {
      headers.set('Content-Type', 'application/pdf');
    }

    return new NextResponse(response.body, {
      status: response.status,
      headers,
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 

export async function HEAD(
  request: NextRequest,
  ctx: { params: Promise<{ graphId: string; assetId: string }> }
) {
  try {
    const res = await GET(request, ctx);
    
    // Return the same headers but no body
    return new NextResponse(null, { 
      status: res.status, 
      headers: res.headers 
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}