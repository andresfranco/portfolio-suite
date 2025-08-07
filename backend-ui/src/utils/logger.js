/**
 * Logger utility for the application
 * Provides consistent logging with different levels
 */

// Log levels
const LOG_LEVEL = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
};

// Default to DEBUG in development, INFO in production
const DEFAULT_LOG_LEVEL = process.env.NODE_ENV === 'production' 
  ? LOG_LEVEL.INFO 
  : LOG_LEVEL.DEBUG;

// Current log level can be overridden
let currentLogLevel = DEFAULT_LOG_LEVEL;

// Allow log level to be changed at runtime
export const setLogLevel = (level) => {
  if (level in LOG_LEVEL) {
    currentLogLevel = LOG_LEVEL[level];
    return true;
  }
  return false;
};

// Format objects and arrays for logging
const formatValue = (value) => {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  
  if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
    try {
      return JSON.stringify(value, null, 2);
    } catch (e) {
      return String(value);
    }
  }
  
  return value;
};

// Debug level logging - only in development
export const logDebug = (...args) => {
  if (currentLogLevel <= LOG_LEVEL.DEBUG) {
    console.debug(
      '%c[DEBUG]%c',
      'color: #6c757d; font-weight: bold',
      'color: inherit',
      ...args.map(formatValue)
    );
  }
};

// Info level logging
export const logInfo = (...args) => {
  if (currentLogLevel <= LOG_LEVEL.INFO) {
    console.info(
      '%c[INFO]%c',
      'color: #0d6efd; font-weight: bold',
      'color: inherit',
      ...args.map(formatValue)
    );
  }
};

// Warning level logging
export const logWarn = (...args) => {
  if (currentLogLevel <= LOG_LEVEL.WARN) {
    console.warn(
      '%c[WARN]%c',
      'color: #fd7e14; font-weight: bold',
      'color: inherit',
      ...args.map(formatValue)
    );
  }
};

// Error level logging
export const logError = (...args) => {
  if (currentLogLevel <= LOG_LEVEL.ERROR) {
    console.error(
      '%c[ERROR]%c',
      'color: #dc3545; font-weight: bold',
      'color: inherit',
      ...args.map(formatValue)
    );
  }
  
  // If the first argument is an Error object, log its stack trace
  if (args[0] instanceof Error) {
    if (currentLogLevel <= LOG_LEVEL.ERROR) {
      console.error(args[0].stack);
    }
  }
};

// Performance timing
export const logPerformance = (label, fn) => {
  if (currentLogLevel <= LOG_LEVEL.DEBUG) {
    console.time(`[PERF] ${label}`);
    const result = fn();
    console.timeEnd(`[PERF] ${label}`);
    return result;
  } else {
    return fn();
  }
};

// Force log to console regardless of log level settings
// Useful for debugging critical issues
export const logForce = (...args) => {
  console.log(
    '%c[FORCE]%c',
    'color: #ff5722; font-weight: bold; font-size: 1.1em',
    'color: inherit',
    ...args.map(formatValue)
  );
};

// Default logger object with all methods
const logger = {
  debug: logDebug,
  info: logInfo,
  warn: logWarn,
  error: logError,
  performance: logPerformance,
  force: logForce,
  setLevel: setLogLevel
};

export default logger; 