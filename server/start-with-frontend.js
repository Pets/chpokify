const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Paths in Docker container (working directory is /home)
const STANDALONE_DIR = '/home/frontend/.next/standalone';
const BACKEND_SERVER = path.join('/home', 'server/build/index.js');

// Backend always uses port 8083 internally (ignore any PORT env var for backend)
const BACKEND_PORT = '8083';

// Frontend uses Koyeb's PORT, but must be different from backend
// Koyeb typically provides PORT=8000, but if user misconfigured PORT=8083, use 8000 instead
let FRONTEND_PORT = process.env.PORT || '8000';
if (FRONTEND_PORT === BACKEND_PORT) {
  console.warn('WARNING: PORT env var conflicts with backend port. Using 8000 for frontend.');
  FRONTEND_PORT = '8000';
}

// Find server.js - in monorepos with outputFileTracingRoot, Next.js places it in a subdirectory
function findServerJs(baseDir) {
  // Try common locations - monorepo structure mirrors the project path
  const possiblePaths = [
    path.join(baseDir, 'server.js'),                           // Direct (no outputFileTracingRoot)
    path.join(baseDir, 'frontend', 'server.js'),               // Monorepo: /standalone/frontend/server.js
    path.join(baseDir, 'home', 'frontend', 'server.js'),       // Docker path: /standalone/home/frontend/server.js
  ];
  
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return { serverPath: p, cwd: path.dirname(p) };
    }
  }
  
  // Search recursively as fallback
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

// First, list what's actually in the standalone directory
console.log('=== Standalone directory contents ===');
try {
  const listDir = (dir, prefix = '') => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    entries.slice(0, 20).forEach(e => {
      console.log(prefix + e.name + (e.isDirectory() ? '/' : ''));
      if (e.isDirectory() && e.name !== 'node_modules' && prefix.length < 6) {
        try { listDir(path.join(dir, e.name), prefix + '  '); } catch {}
      }
    });
  };
  if (fs.existsSync(STANDALONE_DIR)) {
    listDir(STANDALONE_DIR);
  } else {
    console.log('STANDALONE_DIR does not exist:', STANDALONE_DIR);
  }
} catch (e) {
  console.log('Error listing standalone dir:', e.message);
}

const frontendInfo = findServerJs(STANDALONE_DIR);

console.log('=== Starting Chpokify servers ===');
console.log('Standalone base dir:', STANDALONE_DIR);
console.log('Frontend server.js:', frontendInfo ? frontendInfo.serverPath : 'NOT FOUND');
console.log('Frontend cwd:', frontendInfo ? frontendInfo.cwd : 'N/A');
console.log('Backend path:', BACKEND_SERVER);
console.log('Frontend port:', FRONTEND_PORT);
console.log('Backend port (internal):', BACKEND_PORT);
console.log('PORT env var:', process.env.PORT);

if (!frontendInfo) {
  console.error('ERROR: Cannot find server.js in standalone directory');
  console.log('Listing standalone directory contents recursively:');
  try {
    const listDir = (dir, prefix = '') => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      entries.forEach(e => {
        console.log(prefix + e.name + (e.isDirectory() ? '/' : ''));
        if (e.isDirectory() && e.name !== 'node_modules') {
          try { listDir(path.join(dir, e.name), prefix + '  '); } catch {}
        }
      });
    };
    listDir(STANDALONE_DIR);
  } catch (e) {
    console.error('Cannot read standalone dir:', e.message);
  }
  process.exit(1);
}

if (!fs.existsSync(BACKEND_SERVER)) {
  console.error('ERROR: Backend server not found at:', BACKEND_SERVER);
  process.exit(1);
}

// Start Express backend on port 8083 (internal)
console.log('Starting Express backend on port', BACKEND_PORT);
const backend = spawn('node', [BACKEND_SERVER], {
  stdio: 'inherit',
  env: { 
    ...process.env,
    APP_PORT: BACKEND_PORT,
    APP_ADDRESS: '0.0.0.0',
  },
});

backend.on('error', (err) => {
  console.error('Failed to start backend:', err);
});

backend.on('exit', (code, signal) => {
  console.error('Backend exited with code:', code, 'signal:', signal);
});

// Wait a bit for backend to start, then start Next.js frontend
setTimeout(() => {
  console.log('Starting Next.js frontend on port', FRONTEND_PORT);
  console.log('Frontend cwd:', frontendInfo.cwd);
  
  // Next.js standalone must be run from within the directory containing server.js
  const frontend = spawn('node', ['server.js'], {
    stdio: 'inherit',
    cwd: frontendInfo.cwd,
    env: { 
      ...process.env,
      PORT: FRONTEND_PORT,
      HOSTNAME: '0.0.0.0',
      // Point Next.js API calls to the backend
      BASE_API_SSR_URL: `http://localhost:${BACKEND_PORT}`,
      BASE_API_CLIENT_URL: '/api',
    },
  });

  frontend.on('error', (err) => {
    console.error('Failed to start frontend:', err);
  });

  frontend.on('exit', (code, signal) => {
    console.error('Frontend exited with code:', code, 'signal:', signal);
    // If frontend crashes, exit the whole process so Koyeb can restart
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
