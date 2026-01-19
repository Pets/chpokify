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

# Install tsc-alias for path alias resolution in compiled output
RUN yarn add -W tsc-alias

# Copy all source code
COPY server/ ./server/
COPY packages/ ./packages/

# Compile TypeScript to JavaScript from server directory
WORKDIR /home/server
RUN yarn tsc --project tsconfig.build.json && yarn tsc-alias -p tsconfig.build.json

# Go back to workspace root so node_modules/@chpokify/* symlinks work
WORKDIR /home

# Expose port
EXPOSE 8083

# Run compiled JavaScript from workspace root
CMD ["node", "server/dist/index.js"]
