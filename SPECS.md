# Chpokify - Technical Specifications

## Overview

Chpokify is an Agile team collaboration platform providing Planning Poker, Retrospectives, and Kanban boards. It's a self-hosted fork originally from chpokify.com, now deployed on Koyeb with Upstash Redis and MongoDB Atlas.

---

## Architecture

### Monorepo Structure (Yarn Workspaces)

```
chpokify/
├── frontend/           # Next.js 12.3.4 (React 17) - Port 8000
├── server/             # Express.js 4.17 + Socket.IO 4.0 - Port 8083
├── packages/           # Shared workspace packages
│   ├── api-schemas/    # API contract types (request/response shapes)
│   ├── helpers/        # Shared utility functions (isServer, etc.)
│   ├── models-types/   # TypeScript model interfaces
│   ├── routing/        # URL routing helpers
│   └── i18n/           # Internationalization (en/ru)
├── migrations/         # MongoDB migrations
├── nginx/              # Original nginx reverse proxy config (NOT used in Docker)
├── figma/              # Figma plugin source
└── tilda/              # Landing page builder
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend Framework | Next.js 12.3.4 (standalone output mode) |
| UI Library | React 17.0.2 |
| Styling | Styled Components 5.1.1 + Material-UI 4.11.3 |
| State Management | Redux Toolkit 1.7.1 |
| Data Fetching | SWR 2.0.0, Axios 1.2.1 |
| Backend Framework | Express.js 4.17.1 |
| Real-time | Socket.IO 4.0.0 (server + client via Web Worker) |
| Database | MongoDB 6.1.6 (Mongoose ODM) |
| Cache/Queue | Redis via ioredis 4.17.3 (Upstash) |
| Job Queue | Bull 3.28.1 (Jira integration jobs) |
| Auth | Passport.js + JWT + Express Sessions (MongoDB store) |
| Build | Webpack 5.10.1 + Babel 7 |
| Language | TypeScript 4.5.5 |

### Deployment Architecture (Koyeb)

```
Koyeb Container (Single Docker instance)
├── start-with-frontend.js (orchestrator)
│
├── Next.js Frontend (Port 8000 - public, exposed to Koyeb)
│   ├── Serves UI at /
│   ├── Rewrites /api/* → http://localhost:8083/api/*
│   ├── Rewrites /socket.worker.js → /_next/socket.worker.js
│   └── Static files (standalone output)
│
├── Express Backend (Port 8083 - internal only)
│   ├── REST API at /api/*
│   ├── Socket.IO at /socket.io/
│   ├── Session auth (Passport + MongoDB session store)
│   └── Bull queue (Jira integration)
│
├── MongoDB Atlas (external, cloud)
├── Upstash Redis (external, TLS)
└── Web Worker (browser-side, runs Socket.IO client)
```

### Original Architecture (with nginx)

The original deployment used nginx as reverse proxy:
- `/api/*` → Express backend (HTTP)
- `/socket.io/*` → Express backend (WebSocket upgrade with proper HTTP/1.1 headers)
- `/*` → Next.js frontend
- `/tilda/*` → Tilda landing page service

---

## Features

### 1. Planning Poker
- **Sessions**: Create estimation sessions linked to a Space (team)
- **Stories**: Import stories manually or from Jira
- **Voting**: Team members vote using customizable card decks (Fibonacci, T-shirt sizes, custom)
- **Auto-reveal**: Optional auto-show votes when all participants have voted
- **Presence**: Real-time user online status (polling every 5s)
- **Jira Integration**: OAuth, auto-write estimates back to Jira fields, bulk import
- **Video calls**: Embedded Jitsi video conferencing

### 2. Retrospectives
- **Templates**: Went Well/Go Well, Start/Stop/Continue, Mad/Sad/Glad, Custom
- **Cards**: Anonymous submission, voting, sorting
- **Controls**: Hide/show cards, timer, discussion mode
- **Relations**: Link retro items together

### 3. Kanban Boards
- **Columns**: Customizable columns with drag-and-drop
- **Cards**: Task cards with drag-and-drop reordering

### 4. Spaces (Teams)
- **Multi-team**: Users can belong to multiple spaces
- **Invites**: Email-based invite system with expiration
- **Roles**: Space-level permissions

### 5. Integrations
- **Jira**: OAuth 1.0, field mapping, bulk import, auto-write
- **Google**: OAuth login
- **Apple**: Sign-in with Apple
- **Stripe**: Subscription billing (Customer model)
- **Web3**: Sign-In With Ethereum (SIWE)

---

## Real-Time Architecture

### Socket.IO Flow

```
Browser                         Web Worker              Express (8083)
  │                                │                        │
  │ SocketProvider creates         │                        │
  │ WebWorkerIO.connect()          │                        │
  │ ──postMessage(connect)──►      │                        │
  │                                │ io(url, {websocket})   │
  │                                │ ──────────────────────►│ Socket.IO Server
  │                                │                        │ (auth via session middleware)
  │                                │◄──── connect ──────────│
  │◄── postMessage(connect) ──     │                        │
  │                                │                        │
  │ useSocketSubscribe             │                        │
  │ ──emit(joinRoom, roomId)──►    │ ──emit(joinRoom)──►    │ socket.join(roomId)
  │                                │                        │
  │                                │                        │ Mongoose post('save') hook
  │                                │                        │ io.to(roomId).emit(data)
  │                                │◄── event data ─────────│
  │◄── postMessage(data) ────      │                        │
  │                                │                        │
  │ Redux dispatch(upsert)         │                        │
  │ UI re-renders                  │                        │
```

### Socket Room Naming Convention

| Room Pattern | Model | Trigger |
|-------------|-------|---------|
| `pokerSession:{spaceId}` | PokerSession | Poker session CRUD |
| `retroSession:{spaceId}` | RetroSession | Retro session CRUD |
| `space:{spaceId}` | Space | Space settings changes |
| `storySpace:{spaceId}` | Story | Story CRUD in poker |
| `userSpace:{spaceId}` | User | User profile changes |
| `retroCard:{retroSessionId}` | RetroCard | Retro card CRUD |
| `retroTemplate:{spaceId}` | RetroTemplate | Template changes |
| `pokerSessionRatingModal:{pokerSessionId}` | - | Rating prompt |

### Fallback Mechanisms

1. **Visibility Sync** (`PokerVisibilitySyncProcessor`): When tab becomes visible again or socket reconnects, refetches poker session + stories from API
2. **User Polling** (`PokerUserInSessionScheduller`): POST to `/api/poker-sessions/:id/set-in-session` every 5s to maintain online presence
3. **Reconnection**: Web Worker falls back to `['polling', 'websocket']` transports on reconnect attempt

---

## Data Models (MongoDB)

| Model | Collection | Key Fields |
|-------|-----------|------------|
| User | users | email, username, password, googleId, appleId |
| Space | spaces | name, participantsIds, createdById |
| PokerSession | pokersessions | title, spaceId, cardSetType, isAutoReveal |
| Story | stories | title, spaceId, pokerSessionId, scores |
| RetroSession | retrosessions | spaceId, templateId, settings |
| RetroCard | retrocards | retroSessionId, columnId, text, votes |
| RetroTemplate | retrotemplates | spaceId, type, columns |
| RetroRelation | retrorelations | retroSessionId, sourceCardId, targetCardId |
| PokerCardDeck | pokercarddecks | spaceId, cards, name |
| KanbanBoard | kanbanboards | spaceId, columns |
| Customer | customers | userId, stripeCustomerId |

---

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `MONGO_CONNECTION_STRING` | MongoDB Atlas connection URI | `mongodb+srv://user:pass@cluster.mongodb.net/poker` |
| `REDIS_HOST` | Upstash Redis host | `xxx.upstash.io` |
| `REDIS_PORT` | Upstash Redis port | `6379` |
| `REDIS_PASSWORD` | Upstash Redis password | `xxxxx` |
| `APP_SECRET` | Express session secret | random string |
| `APP_COOKIE_SESSION_NAME` | Session cookie name | `chpokify.sid` |
| `PORT` | Koyeb public port | `8000` |

### Set at Runtime (start-with-frontend.js)

| Variable | Value | Notes |
|----------|-------|-------|
| `APP_PORT` | `8083` | Express internal port |
| `BASE_API_SSR_URL` | `http://localhost:8083` | Server-side API calls |
| `BASE_API_CLIENT_URL` | `/api` | Client-side API base (baked at build) |

### Optional

| Variable | Description |
|----------|-------------|
| `CLIENT_SENTRY_DSN` | Sentry DSN for frontend error tracking |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `STRIPE_SECRET_KEY` | Stripe billing |
| `JIRA_*` | Jira OAuth credentials |

---

## Build & Deploy

### Docker Build (server/Dockerfile)

1. **Install deps**: `yarn install` from workspace root
2. **Build frontend**: `STANDALONE_BUILD=true yarn frontend run build` → Next.js standalone output
3. **Copy static**: public/ + .next/static/ into standalone folder
4. **Remove Sentry**: Strip @sentry/nextjs from standalone (incompatible)
5. **Build backend**: `yarn server:build` → Webpack bundle to server/build/index.js
6. **Copy configs**: server/config/*.json → /home/config/
7. **Start**: `node start-with-frontend.js`

### Runtime Startup (start-with-frontend.js)

1. Starts Express backend on port 8083 (internal)
2. Waits 2 seconds
3. Starts Next.js standalone on port 8000 (public)
4. Next.js rewrites `/api/*` to Express on 8083

---

## Known Issues

### Auto-refresh / Real-time Updates Not Working

See dedicated analysis in the refresh issue investigation section of CLAUDE.md.
