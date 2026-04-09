const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

// Paths in Docker container (working directory is /home)
const STANDALONE_DIR = '/home/frontend/.next/standalone';
const BACKEND_SERVER = path.join('/home', 'server/build/index.js');

// Internal ports (not exposed to Koyeb)
const BACKEND_PORT = 8083;
const FRONTEND_PORT_INTERNAL = 3000;

// Public port (exposed to Koyeb)
const PUBLIC_PORT = process.env.PORT || 8000;

// Find server.js - in monorepos with outputFileTracingRoot, Next.js places it in a subdirectory
function findServerJs(baseDir) {
  const possiblePaths = [
    path.join(baseDir, 'server.js'),
    path.join(baseDir, 'frontend', 'server.js'),
    path.join(baseDir, 'home', 'frontend', 'server.js'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return { serverPath: p, cwd: path.dirname(p) };
    }
  }

  function searchDir(dir, depth = 0) {
    if (depth > 3) return null;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name === 'server.js') {
          return path.join(dir, entry.name);
        }
      }
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.next') {
          const found = searchDir(path.join(dir, entry.name), depth + 1);
          if (found) return found;
        }
      }
    } catch (e) {}
    return null;
  }

  const found = searchDir(baseDir);
  if (found) {
    return { serverPath: found, cwd: path.dirname(found) };
  }

  return null;
}

const frontendInfo = findServerJs(STANDALONE_DIR);

console.log('=== Starting Chpokify servers ===');
console.log('Frontend server.js:', frontendInfo ? frontendInfo.serverPath : 'NOT FOUND');
console.log('Backend path:', BACKEND_SERVER);
console.log('Public port:', PUBLIC_PORT);
console.log('Frontend internal port:', FRONTEND_PORT_INTERNAL);
console.log('Backend internal port:', BACKEND_PORT);

if (!frontendInfo) {
  console.error('ERROR: Cannot find server.js in standalone directory');
  process.exit(1);
}

if (!fs.existsSync(BACKEND_SERVER)) {
  console.error('ERROR: Backend server not found at:', BACKEND_SERVER);
  process.exit(1);
}

// Start Express backend on internal port
console.log('Starting Express backend on port', BACKEND_PORT);
const backend = spawn('node', [BACKEND_SERVER], {
  stdio: 'inherit',
  env: {
    ...process.env,
    APP_PORT: String(BACKEND_PORT),
    APP_ADDRESS: '0.0.0.0',
  },
});

backend.on('error', (err) => {
  console.error('Failed to start backend:', err);
});

backend.on('exit', (code, signal) => {
  console.error('Backend exited with code:', code, 'signal:', signal);
});

// Start Next.js frontend on internal port
setTimeout(() => {
  console.log('Starting Next.js frontend on port', FRONTEND_PORT_INTERNAL);

  const frontend = spawn('node', ['server.js'], {
    stdio: 'inherit',
    cwd: frontendInfo.cwd,
    env: {
      ...process.env,
      PORT: String(FRONTEND_PORT_INTERNAL),
      HOSTNAME: '0.0.0.0',
      BASE_API_SSR_URL: `http://localhost:${BACKEND_PORT}`,
      BASE_API_CLIENT_URL: '/api',
    },
  });

  frontend.on('error', (err) => {
    console.error('Failed to start frontend:', err);
  });

  frontend.on('exit', (code, signal) => {
    console.error('Frontend exited with code:', code, 'signal:', signal);
    process.exit(1);
  });

  const cleanup = () => {
    console.log('Shutting down servers...');
    backend.kill();
    frontend.kill();
    process.exit(0);
  };

  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);
}, 2000);

// ─── Reverse Proxy (replaces nginx) ───────────────────────────────────
// Routes:
//   /socket.io/*  → Express backend (HTTP + WebSocket upgrade)
//   /api/*        → Express backend (HTTP)
//   /*            → Next.js frontend (HTTP)

function proxyRequest(req, res, targetPort) {
  const proxyReq = http.request(
    {
      hostname: '127.0.0.1',
      port: targetPort,
      path: req.url,
      method: req.method,
      headers: req.headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    }
  );

  proxyReq.on('error', (err) => {
    console.error(`Proxy HTTP error (port ${targetPort}):`, err.message);
    if (!res.headersSent) {
      res.writeHead(502);
      res.end('Bad Gateway');
    }
  });

  req.pipe(proxyReq, { end: true });
}

function getTargetPort(url) {
  if (url.startsWith('/socket.io')) return BACKEND_PORT;
  if (url.startsWith('/api')) return BACKEND_PORT;
  return FRONTEND_PORT_INTERNAL;
}

const proxy = http.createServer((req, res) => {
  proxyRequest(req, res, getTargetPort(req.url));
});

// WebSocket upgrade handler — critical for Socket.IO real-time
proxy.on('upgrade', (req, socket, head) => {
  const targetPort = getTargetPort(req.url);

  const proxyReq = http.request({
    hostname: '127.0.0.1',
    port: targetPort,
    path: req.url,
    method: req.method,
    headers: req.headers,
  });

  proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
    // Build the 101 Switching Protocols response
    let response = 'HTTP/1.1 101 Switching Protocols\r\n';
    for (const [key, value] of Object.entries(proxyRes.headers)) {
      response += `${key}: ${value}\r\n`;
    }
    response += '\r\n';

    socket.write(response);

    if (proxyHead.length > 0) {
      proxySocket.write(proxyHead);
    }

    proxySocket.pipe(socket);
    socket.pipe(proxySocket);

    proxySocket.on('error', () => socket.destroy());
    socket.on('error', () => proxySocket.destroy());
  });

  proxyReq.on('error', (err) => {
    console.error('Proxy WebSocket error:', err.message);
    socket.destroy();
  });

  proxyReq.end();
});

// Wait for backend + frontend to start, then open the public port
setTimeout(() => {
  proxy.listen(Number(PUBLIC_PORT), '0.0.0.0', () => {
    console.log(`Reverse proxy listening on port ${PUBLIC_PORT}`);
    console.log(`  /socket.io/* → localhost:${BACKEND_PORT} (WebSocket + HTTP)`);
    console.log(`  /api/*       → localhost:${BACKEND_PORT} (HTTP)`);
    console.log(`  /*           → localhost:${FRONTEND_PORT_INTERNAL} (Next.js)`);
  });
}, 4000);
