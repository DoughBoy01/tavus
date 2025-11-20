/**
 * Logger utility for consistent logging across the application
 * Only logs in development mode unless explicitly enabled
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  enableInProduction?: boolean;
  minLevel?: LogLevel;
}

class Logger {
  private isDevelopment: boolean;
  private enableInProduction: boolean;
  private minLevel: LogLevel;

  private levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor(config: LoggerConfig = {}) {
    this.isDevelopment = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEBUG_LOGGING === 'true';
    this.enableInProduction = config.enableInProduction ?? false;
    this.minLevel = config.minLevel ?? 'debug';
  }

  private shouldLog(level: LogLevel): boolean {
    if (this.isDevelopment) return true;
    if (this.enableInProduction && this.levelPriority[level] >= this.levelPriority[this.minLevel]) {
      return true;
    }
    return false;
  }

  private formatMessage(level: LogLevel, message: string, data?: unknown): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  }

  debug(message: string, data?: unknown): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message), data ?? '');
    }
  }

  info(message: string, data?: unknown): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message), data ?? '');
    }
  }

  warn(message: string, data?: unknown): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message), data ?? '');
    }
  }

  error(message: string, error?: unknown): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message), error ?? '');
    }
  }
}

// Export singleton instance
export const logger = new Logger({
  enableInProduction: false, // Only log errors in production
  minLevel: 'error',
});

// For edge functions (Deno environment)
export class EdgeLogger {
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = Deno.env.get('ENVIRONMENT') === 'development';
  }

  private shouldLog(): boolean {
    return this.isDevelopment;
  }

  debug(message: string, data?: unknown): void {
    if (this.shouldLog()) {
      console.debug(`[DEBUG] ${message}`, data ?? '');
    }
  }

  info(message: string, data?: unknown): void {
    console.info(`[INFO] ${message}`, data ?? '');
  }

  warn(message: string, data?: unknown): void {
    console.warn(`[WARN] ${message}`, data ?? '');
  }

  error(message: string, error?: unknown): void {
    console.error(`[ERROR] ${message}`, error ?? '');
  }
}

export default logger;
