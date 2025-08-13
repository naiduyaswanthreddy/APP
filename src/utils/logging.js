const levelEnabled = {
  debug: process.env.NODE_ENV !== 'production',
  info: true,
  warn: true,
  error: true,
};

export const logger = {
  debug: (...args) => levelEnabled.debug && console.debug('[DEBUG]', ...args),
  info: (...args) => levelEnabled.info && console.info('[INFO]', ...args),
  warn: (...args) => levelEnabled.warn && console.warn('[WARN]', ...args),
  error: (...args) => levelEnabled.error && console.error('[ERROR]', ...args),
};

