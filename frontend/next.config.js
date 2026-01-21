// const { withSentryConfig } = require('@sentry/nextjs');
const path = require('path');
const shortid = require('shortid');

const { i18n } = require('./next-i18next.config');

const BUILD_ID = shortid();

// For standalone builds (Docker), we skip plugins that break standalone output
const isStandalone = process.env.STANDALONE_BUILD === 'true';

// Packages to transpile - these are workspace packages that need to be compiled
const transpilePackages = [
  '@chpokify/helpers',
  '@chpokify/api-schemas',
  '@chpokify/models-types',
  '@chpokify/routing',
];

/** @type {import('next').NextConfig} */
const baseConfig = {
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
  // STANDALONE BUILD: Export plain config WITHOUT any plugins
  // next-transpile-modules breaks output: 'standalone', so we handle transpilation via webpack
  module.exports = {
    ...baseConfig,
    output: 'standalone',
    experimental: {
      outputFileTracingRoot: path.join(__dirname, '../'),
    },
    webpack: (config, { isServer, defaultLoaders }) => {
      config.output.globalObject = '(typeof self !== \'undefined\' ? self : this)';

      config.module.rules.push({
        test: /\.worker\.*/,
        loader: 'worker-loader',
        options: {
          filename: 'static/[hash].worker.js',
          publicPath: '/_next/',
        },
      });

      // Manually transpile @chpokify/* packages (replaces next-transpile-modules)
      // These packages are in ../packages/ relative to frontend
      const packagesDir = path.join(__dirname, '../packages');
      
      // Use Next.js's default loader (SWC in 12.3+) for transpilation
      config.module.rules.push({
        test: /\.(tsx?|jsx?)$/,
        include: [packagesDir],
        use: defaultLoaders.babel ? [defaultLoaders.babel] : [],
        // Let Next.js handle these files with its default loader
      });

      // Make sure webpack resolves these packages correctly
      config.resolve.alias = {
        ...config.resolve.alias,
        '@chpokify/helpers': path.join(packagesDir, 'helpers'),
        '@chpokify/api-schemas': path.join(packagesDir, 'api-schemas'),
        '@chpokify/models-types': path.join(packagesDir, 'models-types'),
        '@chpokify/routing': path.join(packagesDir, 'routing'),
        // Replace @sentry/nextjs with a stub to prevent runtime errors in standalone mode
        // @sentry/nextjs tries to require 'next' which doesn't exist in standalone builds
        '@sentry/nextjs': path.join(__dirname, 'lib/sentry-stub.js'),
        '@sentry/integrations': path.join(__dirname, 'lib/sentry-stub.js'),
      };

      return config;
    },
  };
} else {
  // NON-STANDALONE BUILD: Use plugins for local development
  const withTM = require('next-transpile-modules')(transpilePackages);
  const withOffline = require('next-offline');
  
  baseConfig.webpack = (config) => {
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
  };
  
  baseConfig.workboxOpts = {
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
  
  module.exports = withTM(withOffline(baseConfig));
}
