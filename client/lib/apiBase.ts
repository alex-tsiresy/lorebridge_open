// Centralized API base/origin resolution with strict production checks

function isLocalhost(url: string): boolean {
  return /^http:\/\/localhost(?::\d+)?$/.test(url);
}

function trimTrailingSlash(url: string): string {
  return url.replace(/\/$/, "");
}

// Returns '' to use same-origin proxy in the browser, or an absolute origin when provided.
export function getApiBase(options?: { allowLocalhost?: boolean }): string {
  // On client side, always use same-origin to leverage Next.js rewrites
  if (typeof window !== 'undefined') {
    return '';
  }

  const raw = trimTrailingSlash(
    (process.env.API_ORIGIN || process.env.NEXT_PUBLIC_API_URL || '').toString()
  );

  if (!raw) {
    // Same-origin via Next.js rewrites
    return '';
  }

  const localhost = isLocalhost(raw);
  const isHttp = raw.startsWith('http://');

  if (process.env.NODE_ENV === 'production') {
    if (!/^https:\/\//.test(raw)) {
      if (!(options?.allowLocalhost && localhost)) {
        throw new Error('Refusing non-HTTPS API origin in production');
      }
    }
  }

  if (isHttp && !(options?.allowLocalhost && localhost)) {
    // Upgrade to https when not explicitly allowing localhost
    return raw.replace(/^http:\/\//, 'https://');
  }
  return raw;
}

// Streaming-specific API base that bypasses Next.js rewrites to enable real-time streaming
export function getStreamingApiBase(options?: { allowLocalhost?: boolean }): string {
  const raw = trimTrailingSlash(
    (process.env.API_ORIGIN || process.env.NEXT_PUBLIC_API_URL || '').toString()
  );

  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('API_ORIGIN must be set for streaming in production');
    }
    // Dev fallback - direct connection to backend for streaming
    return 'http://localhost:8000';
  }

  const localhost = isLocalhost(raw);
  const isHttp = raw.startsWith('http://');

  if (process.env.NODE_ENV === 'production') {
    if (!/^https:\/\//.test(raw)) {
      if (!(options?.allowLocalhost && localhost)) {
        throw new Error('Refusing non-HTTPS API origin for streaming in production');
      }
    }
  }

  if (isHttp && !(options?.allowLocalhost && localhost)) {
    // Upgrade to https when not explicitly allowing localhost
    return raw.replace(/^http:\/\//, 'https://');
  }
  return raw;
}

// Server-only: must return a concrete origin (not empty). Use API_ORIGIN when set.
export function getServerApiOrigin(options?: { allowLocalhost?: boolean }): string {
  const raw = trimTrailingSlash(
    (process.env.API_ORIGIN || process.env.NEXT_PUBLIC_API_URL || '').toString()
  );

  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('API_ORIGIN must be set in production');
    }
    // Dev fallback
    return 'http://localhost:8000';
  }

  const localhost = isLocalhost(raw);
  if (process.env.NODE_ENV === 'production') {
    if (!/^https:\/\//.test(raw)) {
      if (!(options?.allowLocalhost && localhost)) {
        throw new Error('API_ORIGIN must be https in production');
      }
    }
  }

  if (raw.startsWith('http://') && !(options?.allowLocalhost && localhost)) {
    return raw.replace(/^http:\/\//, 'https://');
  }
  return raw;
}


