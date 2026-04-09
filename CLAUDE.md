# Chpokify - Development Guide

## Project Overview

Agile collaboration platform (Planning Poker, Retrospectives, Kanban). Monorepo with Next.js 12 frontend + Express backend + Socket.IO real-time. Deployed on Koyeb (single Docker container), MongoDB Atlas, Upstash Redis.

## Commands

```bash
# Install
yarn install

# Frontend
yarn frontend run dev          # Next.js dev server (port 3000)
yarn frontend run build        # Production build (use STANDALONE_BUILD=true for Docker)

# Backend
yarn server:dev                # Express dev server (port 8083)
yarn server:build              # Webpack production bundle

# Docker
docker build -f server/Dockerfile -t chpokify .
docker run -p 8000:8000 --env-file .env chpokify
```

## Architecture

```
frontend/                  # Next.js 12.3.4, React 17, Redux Toolkit, Styled Components
server/                    # Express 4.17, Socket.IO 4.0, Mongoose, Bull queues
packages/                  # Shared: api-schemas, helpers, models-types, routing, i18n
```

- **Frontend port**: 8000 (production), 3000 (dev)
- **Backend port**: 8083 (always internal)
- **API proxy**: Next.js rewrites `/api/*` → `http://localhost:8083/api/*`
- **Real-time**: Socket.IO via Web Worker (`frontend/public/socket.worker.js`)

## Key Patterns

### Real-time Updates
- Models use Mongoose `post('save')` hooks to broadcast via Socket.IO
- Frontend subscribes via `useSocketSubscribe(roomId, callback)` hook
- Socket runs in a dedicated Web Worker (isolation from main thread)
- Room pattern: `{modelType}:{spaceId}` (e.g., `pokerSession:abc123`)

### State Management
- Redux Toolkit with entity adapters for normalized state
- `upsert` pattern: socket events dispatch `entityActions.upsert(data)`
- SWR for API data fetching with cache

### Auth
- Passport.js with session middleware (MongoDB-backed sessions)
- Socket.IO authenticates via shared session middleware (wrap pattern)
- Session cookie: `secure: true` in production

## File Locations

| Concept | Path |
|---------|------|
| Socket.IO server | `server/socket/index.ts` |
| Socket Web Worker | `frontend/public/socket.worker.js` |
| Socket React provider | `frontend/components/utils/socket/SocketProvider/index.tsx` |
| Socket subscribe hook | `frontend/components/utils/socket/useSocketSubscribe/index.tsx` |
| WebWorkerSocket class | `frontend/lib/webWorkerSocket.ts` |
| Space subscriptions | `frontend/components/domains/space/utils/SpaceSocketSubscriber/` |
| Poker subscriptions | `frontend/components/domains/poker/utils/PokerSessionSubscriber/` |
| Visibility sync | `frontend/components/domains/poker/utils/PokerVisibilitySyncProcessor/` |
| Redis config | `server/core/lib/redis/index.ts` |
| Session middleware | `server/core/middleware/sessionMiddleware.ts` |
| Docker startup | `server/start-with-frontend.js` |
| Dockerfile | `server/Dockerfile` |
| Next.js config | `frontend/next.config.js` |
| Nginx (original) | `nginx/conf.d/chpokify.xyz.tpl` |

## Environment Variables

Required: `MONGO_CONNECTION_STRING`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `APP_SECRET`, `APP_COOKIE_SESSION_NAME`, `PORT`

`BASE_API_CLIENT_URL` is set at build time via `next.config.js` `env` — changing it at runtime has no effect on client code.

## Koyeb Deployment

Koyeb only needs **one port exposed**: `8000:http`, path `/`.

`start-with-frontend.js` runs a Node.js reverse proxy on port 8000 that handles routing internally:

| Route | Target | Protocol |
|-------|--------|----------|
| `/socket.io/*` | Express :8083 | HTTP + WebSocket upgrade |
| `/api/*` | Express :8083 | HTTP |
| `/*` | Next.js :3000 | HTTP |

This replaces the original nginx reverse proxy. WebSocket upgrades for Socket.IO are handled natively by the proxy's `upgrade` event handler.

## Git Practices

- **Never amend commits**. Always create new, separate commits.

## Conventions

- TypeScript throughout (frontend + backend + packages)
- Mongoose models in `server/models/{modelName}/index.ts`
- API routes in `server/routes/`
- React components in `frontend/components/domains/{domain}/`
- Redux slices in `frontend/Redux/domains/{domain}/`
- Workspace packages prefixed `@chpokify/`
