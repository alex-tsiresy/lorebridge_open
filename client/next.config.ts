import type { NextConfig } from "next";

// Fail-closed: require HTTPS API_ORIGIN in production
const __origin = (process.env.API_ORIGIN || '').replace(/\/$/, '');
if (process.env.NODE_ENV === 'production') {
  if (!__origin) {
    throw new Error('API_ORIGIN must be set in production');
  }
  if (!/^https:\/\//.test(__origin)) {
    if (!/^http:\/\/localhost(?::\d+)?$/.test(__origin)) {
      throw new Error('API_ORIGIN must be https in production');
    }
  }
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
      },
      {
        protocol: 'https',
        hostname: 'images.clerk.dev',
      },
    ],
  },
  turbopack: {
    // Turbopack configuration - for PDF.js and other browser compatibility
  },
  webpack: (config, { isServer }) => {
    // Handle react-pdf and PDF.js properly
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        canvas: false,
      };
      
      // Configure for PDF.js with better image handling
      config.module.rules.push({
        test: /\.m?js$/,
        type: "javascript/auto",
        resolve: {
          fullySpecified: false,
        },
      });
    }

    // Configure externals for PDF.js worker
    config.resolve.fallback = {
      ...config.resolve.fallback,
      canvas: false,
      fs: false,
    };

    // Re-enable optimization for production but handle PDF.js properly
    if (process.env.NODE_ENV === 'production') {
      config.optimization = {
        ...config.optimization,
        minimize: true,
        // Prevent PDF.js workers from being minified incorrectly
        minimizer: config.optimization.minimizer?.filter((minimizer: any) => {
          // Skip minimizing PDF.js worker files
          if (minimizer.constructor.name === 'TerserPlugin') {
            minimizer.options = minimizer.options || {};
            minimizer.options.exclude = /pdf\.worker/;
          }
          return true;
        }),
      };
    } else {
      // Keep disabled for development to avoid issues during dev
      config.optimization = {
        ...config.optimization,
        minimize: false,
      };
    }

    return config;
  },
  async rewrites() {
    const origin = (process.env.API_ORIGIN || 'http://localhost:8000').replace(/\/$/, '');
    const safeOrigin = origin.startsWith('http://') && !/http:\/\/localhost(?::\d+)?/.test(origin)
      ? origin.replace('http://', 'https://')
      : origin;
    return [
      // Exclude file serving routes from rewrites - handle them with Next.js API routes for auth
      {
        source: '/api/v1/graphs/:graphId/assets/:assetId/file',
        destination: '/api/v1/graphs/:graphId/assets/:assetId/file',
      },
      // Rewrite all other API requests to backend
      {
        source: '/api/:path*',
        destination: `${safeOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
