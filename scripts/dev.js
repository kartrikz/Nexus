const { spawn } = require('child_process');
const path = require('path');

console.log('\x1b[35m%s\x1b[0m', '═════════════════════════════════════════════════════════');
console.log('\x1b[36m%s\x1b[0m', '   ⚡ Starting NexusMind in Dual Development Mode ⚡     ');
console.log('\x1b[35m%s\x1b[0m', '═════════════════════════════════════════════════════════');

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';
const nodeCmd = isWindows ? 'node.exe' : 'node';

// 1. Spawn Backend Server
const serverProcess = spawn(nodeCmd, ['server/server.js'], {
  cwd: path.resolve(__dirname, '..'),
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, PORT: process.env.PORT || '3001' }
});

// 2. Spawn Frontend Client
const clientProcess = spawn(npmCmd, ['--prefix', 'client', 'run', 'dev'], {
  cwd: path.resolve(__dirname, '..'),
  stdio: 'inherit',
  shell: true
});

function cleanup() {
  console.log('\n\x1b[33m%s\x1b[0m', 'Shutting down NexusMind services...');
  try { serverProcess.kill(); } catch {}
  try { clientProcess.kill(); } catch {}
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);
