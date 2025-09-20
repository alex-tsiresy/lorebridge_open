type LogLevel = 'log' | 'warn' | 'error' | 'info' | 'debug';

interface Logger {
  log: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
  info: (...args: any[]) => void;
  debug: (...args: any[]) => void;
}

const createLogger = (): Logger => {
  const isDevelopment = process.env.NODE_ENV === 'development';

  const logMethod = (level: LogLevel) => (...args: any[]) => {
    if (isDevelopment) {
      console[level](...args);
    }
  };

  return {
    log: logMethod('log'),
    warn: logMethod('warn'),
    error: logMethod('error'),
    info: logMethod('info'),
    debug: logMethod('debug'),
  };
};

export const logger = createLogger();