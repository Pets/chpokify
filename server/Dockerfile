FROM node:20-alpine

# Create app directory
WORKDIR /home

# Install dependencies first (for better caching)
COPY package.json .
COPY tsconfig.json .
COPY webpack.config.js .
COPY babel.config.js .

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

# Build with webpack (bundles everything including @chpokify/* packages)
# Use legacy OpenSSL provider for webpack 5.x compatibility with Node 20
ENV NODE_OPTIONS="--openssl-legacy-provider"
RUN yarn server:build

# Expose port
EXPOSE 8083

# Run the bundled JavaScript
CMD ["node", "server/build/index.js"]
