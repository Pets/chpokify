FROM node:20-alpine

# Create app directory
WORKDIR /home

# Install dependencies first (for better caching)
COPY package.json .
COPY tsconfig.json .
COPY webpack.config.js .
COPY babel.config.js .

COPY server/package.json ./server/package.json
COPY frontend/package.json ./frontend/package.json
COPY packages/api-schemas/package.json ./packages/api-schemas/package.json
COPY packages/models-types/package.json ./packages/models-types/package.json
COPY packages/helpers/package.json ./packages/helpers/package.json
COPY packages/routing/package.json ./packages/routing/package.json
COPY packages/i18n/package.json ./packages/i18n/package.json

RUN yarn install --frozen-lockfile || yarn install

# Copy all source code
COPY server/ ./server/
COPY frontend/ ./frontend/
COPY packages/ ./packages/

# Build frontend (Next.js with standalone output)
# Set STANDALONE_BUILD to enable standalone output mode
ENV STANDALONE_BUILD=true

# Debug: Print the FULL resolved Next.js config
RUN cd /home/frontend && node -e "const c = require('./next.config.js'); console.log('=== NEXT CONFIG ==='); console.log('output:', c.output); console.log('experimental:', JSON.stringify(c.experimental)); console.log('typeof config:', typeof c); console.log('=== END CONFIG ===');"

# Disable Sentry server-side instrumentation for standalone builds
# @sentry/nextjs tries to require 'next' at runtime which doesn't exist in standalone mode
# Renaming the config file prevents Next.js from loading it during build
RUN mv /home/frontend/sentry.server.config.js /home/frontend/sentry.server.config.js.disabled 2>/dev/null || true

RUN yarn frontend run build

# Copy static files to standalone folder (required for Next.js standalone mode)
RUN cp -r /home/frontend/public /home/frontend/.next/standalone/public 2>/dev/null || true
RUN mkdir -p /home/frontend/.next/standalone/.next && cp -r /home/frontend/.next/static /home/frontend/.next/standalone/.next/static

# Debug: Find server.js location in standalone output
RUN echo "=== Finding server.js in standalone ===" && find /home/frontend/.next/standalone -name "server.js" -type f 2>/dev/null || echo "NO server.js FOUND"
RUN echo "=== Top-level standalone contents ===" && ls -la /home/frontend/.next/standalone/
RUN echo "=== Checking for frontend subfolder ===" && ls -la /home/frontend/.next/standalone/frontend/ 2>/dev/null || echo "No frontend subfolder"
RUN echo "=== Checking for home subfolder ===" && ls -la /home/frontend/.next/standalone/home/ 2>/dev/null || echo "No home subfolder"

# Build backend with webpack (bundles everything including @chpokify/* packages)
# Use legacy OpenSSL provider for webpack 5.x compatibility with Node 20
ENV NODE_OPTIONS="--openssl-legacy-provider"
RUN yarn server:build

# Copy config files for node-config (JSON files for runtime)
RUN mkdir -p /home/config
RUN cp /home/server/config/*.json /home/config/

# Copy startup script to root (it's already in server/ but we need it at /home)
RUN cp /home/server/start-with-frontend.js /home/start-with-frontend.js

# Expose port (Koyeb uses PORT env var, default 8000)
EXPOSE 8000

# Set config directory and clear NODE_OPTIONS for runtime
ENV NODE_CONFIG_DIR="/home/config"
ENV NODE_OPTIONS=""

# Run both backend and frontend
CMD ["node", "start-with-frontend.js"]
