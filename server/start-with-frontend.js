const { spawn } = require('child_process');
const path = require('path');

// Paths in Docker container (working directory is /home)
const FRONTEND_SERVER = path.join('/home', 'frontend/.next/standalone/server.js');
const BACKEND_SERVER = path.join('/home', 'server/build/index.js');

// Koyeb provides PORT env var (usually 8000)
const KOYEB_PORT = process.env.PORT || '8000';
const BACKEND_PORT = '8083';

console.log('Starting Chpokify servers...');
console.log('Frontend path:', FRONTEND_SERVER);
console.log('Backend path:', BACKEND_SERVER);
console.log('Frontend port (Koyeb):', KOYEB_PORT);
console.log('Backend port:', BACKEND_PORT);

// Start Express backend on port 8083 (internal)
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

// Wait a bit for backend to start, then start Next.js frontend on Koyeb's PORT
setTimeout(() => {
  const frontend = spawn('node', [FRONTEND_SERVER], {
    stdio: 'inherit',
    env: { 
      ...process.env,
      PORT: KOYEB_PORT,
      HOSTNAME: '0.0.0.0',
      // Point Next.js API calls to the backend
      BASE_API_SSR_URL: `http://localhost:${BACKEND_PORT}`,
      BASE_API_CLIENT_URL: '/api',
    },
  });

  frontend.on('error', (err) => {
    console.error('Failed to start frontend:', err);
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
