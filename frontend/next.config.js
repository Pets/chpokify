// const { withSentryConfig } = require('@sentry/nextjs');
const shortid = require('shortid');

const { i18n } = require('./next-i18next.config');

const BUILD_ID = shortid();

// For standalone builds (Docker), we use a simplified config without plugins
const isStandalone = process.env.STANDALONE_BUILD === 'true';

// Packages to transpile - used by next-transpile-modules for non-standalone builds
const transpilePackages = [
  '@chpokify/helpers',
  '@chpokify/api-schemas',
  '@chpokify/models-types',
  '@chpokify/routing',
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  i18n,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  generateBuildId: async () => BUILD_ID,
  productionBrowserSourceMaps: true,
  publicRuntimeConfig: {
    ENV: process.env.ENV,
  },
  env: {
    BASE_API_SSR_URL: process.env.BASE_API_SSR_URL,
    BASE_API_CLIENT_URL: process.env.BASE_API_CLIENT_URL,
    APP_COOKIE_SESSION_NAME: process.env.APP_COOKIE_SESSION_NAME,
    CLIENT_SENTRY_DSN: process.env.CLIENT_SENTRY_DSN,
    BUILD_ID,
  },
  images: {
    deviceSizes: [600, 960, 1280, 1920],
    domains: [
      'storage.googleapis.com',
      'lh1.googleusercontent.com',
      'lh2.googleusercontent.com',
      'lh3.googleusercontent.com',
      'lh4.googleusercontent.com',
      'lh5.googleusercontent.com',
      'lh6.googleusercontent.com',
    ],
  },
  webpack: (config) => {
    config.output.globalObject = '(typeof self !== \'undefined\' ? self : this)';

    config.module.rules.push({
      test: /\.worker\.*/,
      loader: 'worker-loader',
      options: {
        filename: 'static/[hash].worker.js',
        publicPath: '/_next/',
      },
    });
    return config;
  },
  async rewrites() {
    return [
      {
        source: '/service-worker.js',
        destination: '/_next/static/service-worker.js',
      },
      {
        source: '/socket.worker.js',
        destination: '/_next/socket.worker.js',
      },
      // Proxy API requests to Express backend
      {
        source: '/api/:path*',
        destination: 'http://localhost:8083/api/:path*',
      },
    ];
  },
};

if (isStandalone) {
  // STANDALONE BUILD: Use next-transpile-modules but ensure output: 'standalone' is preserved
  const withTM = require('next-transpile-modules')(transpilePackages);
  
  // Create the config with output: 'standalone' AFTER applying withTM
  const standaloneConfig = withTM(nextConfig);
  
  // Force output: 'standalone' - withTM might not preserve it
  module.exports = {
    ...standaloneConfig,
    output: 'standalone',
  };
} else {
  // NON-STANDALONE BUILD: Use plugins for local development
  const withTM = require('next-transpile-modules')(transpilePackages);
  const withOffline = require('next-offline');
  
  nextConfig.workboxOpts = {
    swDest: process.env.NEXT_EXPORT
      ? 'service-worker.js'
      : 'static/service-worker.js',
    runtimeCaching: [
      {
        urlPattern: /\.(png|jpg|jpeg|svg|webp)$/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'images',
          expiration: {
            maxEntries: 200,
          },
        },
      },
      {
        urlPattern: /\.(eot|woff|woff2|ttf)$/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'fonts',
          expiration: {
            maxEntries: 200,
          },
        },
      },
      {
        urlPattern: /\/api\//,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'offlineCache',
          expiration: {
            maxEntries: 200,
          },
        },
      },
    ],
  };
  
  module.exports = withTM(withOffline(nextConfig));
}
