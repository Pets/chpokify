FROM node:20-alpine

# Create app directory
WORKDIR /home

# Install dependencies first (for better caching)
COPY package.json .
COPY tsconfig.json .

COPY server/package.json ./server/package.json
COPY packages/api-schemas/package.json ./packages/api-schemas/package.json
COPY packages/models-types/package.json ./packages/models-types/package.json
COPY packages/helpers/package.json ./packages/helpers/package.json
COPY packages/routing/package.json ./packages/routing/package.json
COPY packages/i18n/package.json ./packages/i18n/package.json

RUN yarn install --frozen-lockfile || yarn install

# Copy all source code
COPY server/ ./server/
COPY packages/ ./packages/

# Install tsconfig-paths for runtime path alias resolution
RUN yarn add tsconfig-paths

# Set working directory to server
WORKDIR /home/server

# Expose port
EXPOSE 8083

# Run with ts-node and tsconfig-paths for path alias support
CMD ["node", "-r", "ts-node/register", "-r", "tsconfig-paths/register", "index.ts"]
