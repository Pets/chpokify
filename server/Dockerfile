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
RUN yarn frontend run build

# Copy static files to standalone folder (required for Next.js standalone mode)
RUN cp -r /home/frontend/public /home/frontend/.next/standalone/public 2>/dev/null || true
RUN mkdir -p /home/frontend/.next/standalone/.next && cp -r /home/frontend/.next/static /home/frontend/.next/standalone/.next/static

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
