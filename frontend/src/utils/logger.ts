// src/utils/logger.ts
type LogLevel = 'info' | 'warn' | 'error' | 'success';

const logger = {
  info: (...args: any[]) => {
    console.log('📘 [INFO]:', ...args);
  },
  
  warn: (...args: any[]) => {
    console.warn('⚠️ [WARN]:', ...args);
  },
  
  error: (...args: any[]) => {
    console.error('❌ [ERROR]:', ...args);
  },
  
  success: (...args: any[]) => {
    console.log('✅ [SUCCESS]:', ...args);
  },

  // Helper for development
  debug: (...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('\x1b[35m%s\x1b[0m', '🔍 [DEBUG]:', ...args);
    }
  }
};

export default logger;