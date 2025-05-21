/**
 * Script to start both client and server in sync
 * This helps ensure all processes are using the same code version
 */
const { spawn } = require('child_process');
const path = require('path');

// Clear console
console.clear();
console.log('🔄 Synchronizing StockHub client and server...');

// Kill any existing Node.js processes (Windows)
try {
  console.log('🛑 Stopping any existing Node.js processes...');
  spawn('taskkill', ['/F', '/IM', 'node.exe'], { shell: true });
} catch (err) {
  // Ignore errors if no processes found
}

// Start the backend server
console.log('🚀 Starting server...');
const server = spawn('node', ['index.js'], {
  cwd: path.join(__dirname, 'server'),
  shell: true,
  stdio: 'inherit'
});

// Wait a bit before starting the client to ensure server is ready
setTimeout(() => {
  console.log('🚀 Starting client...');
  // Use cross-env to set the backend URL for development
  const client = spawn('npm', ['start'], {
    shell: true,
    stdio: 'inherit',
    env: {
      ...process.env,
      REACT_APP_API_URL: 'http://localhost:5000',
      BROWSER: 'none' // Prevent auto-opening browser
    }
  });

  // Handle client exit
  client.on('close', (code) => {
    console.log(`🛑 Client process exited with code ${code}`);
    // Kill server when client exits
    server.kill();
  });
}, 3000);

// Handle server exit
server.on('close', (code) => {
  console.log(`🛑 Server process exited with code ${code}`);
});

// Handle script termination
process.on('SIGINT', () => {
  console.log('🛑 Stopping all processes...');
  server.kill();
  process.exit();
});

console.log('✅ Synchronization complete. Both client and server are running with the latest code.');
console.log('⚠️ Press Ctrl+C to stop all processes.'); 