import { spawn } from 'child_process';
import path from 'path';

// Start Next.js server
const nextServer = spawn('npm', ['run', 'dev'], {
  stdio: 'inherit',
  shell: true
});

// Wait for server to be ready (adjust timeout as needed)
setTimeout(() => {
  // Start bot
  const botProcess = spawn('ts-node', [
    '--project', 'tsconfig.bot.json',
    path.join(__dirname, 'start-bot.ts')
  ], {
    stdio: 'inherit',
    shell: true
  });

  botProcess.on('error', (err) => {
    console.error('Failed to start bot:', err);
    process.exit(1);
  });
}, 5000);

process.on('SIGINT', () => {
  nextServer.kill();
  process.exit();
});