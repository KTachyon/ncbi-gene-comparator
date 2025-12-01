// Logging utilities
// Simple logger that respects silent mode

// Create a logger instance that respects silent flag
export const createLogger = (silent = false) => ({
  log: (...args) => silent || console.log(...args),
  error: (...args) => silent || console.error(...args),
  warn: (...args) => silent || console.warn(...args)
});
