import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

const logsDir = join(process.cwd(), 'logs');

async function ensureLogsDir() {
  try {
    if (!existsSync(logsDir)) {
      await mkdir(logsDir, { recursive: true });
      console.log('Created logs directory:', logsDir);
    } else {
      console.log('Logs directory already exists:', logsDir);
    }
  } catch (error) {
    console.error('Error creating logs directory:', error);
    process.exit(1);
  }
}

ensureLogsDir(); 