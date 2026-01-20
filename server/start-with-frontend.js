const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Paths in Docker container (working directory is /home)
const STANDALONE_DIR = '/home/frontend/.next/standalone';
const FRONTEND_SERVER = path.join(STANDALONE_DIR, 'server.js');
const BACKEND_SERVER = path.join('/home', 'server/build/index.js');

// Koyeb provides PORT env var (usually 8000)
const KOYEB_PORT = process.env.PORT || '8000';
const BACKEND_PORT = '8083';

console.log('=== Starting Chpokify servers ===');
console.log('Frontend standalone dir:', STANDALONE_DIR);
console.log('Frontend server.js:', FRONTEND_SERVER);
console.log('Backend path:', BACKEND_SERVER);
console.log('Frontend port (Koyeb PORT):', KOYEB_PORT);
console.log('Backend port (internal):', BACKEND_PORT);

// Verify files exist
if (!fs.existsSync(FRONTEND_SERVER)) {
  console.error('ERROR: Frontend server.js not found at:', FRONTEND_SERVER);
  console.log('Listing standalone directory contents:');
  try {
    const files = fs.readdirSync(STANDALONE_DIR);
    console.log(files);
  } catch (e) {
    console.error('Cannot read standalone dir:', e.message);
  }
}

if (!fs.existsSync(BACKEND_SERVER)) {
  console.error('ERROR: Backend server not found at:', BACKEND_SERVER);
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

// Wait a bit for backend to start, then start Next.js frontend on Koyeb's PORT
setTimeout(() => {
  console.log('Starting Next.js frontend on port', KOYEB_PORT);
  
  // Next.js standalone must be run from within the standalone directory
  const frontend = spawn('node', ['server.js'], {
    stdio: 'inherit',
    cwd: STANDALONE_DIR,
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
