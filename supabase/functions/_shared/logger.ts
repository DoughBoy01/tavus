/**
 * Edge Function Logger for Deno runtime
 * Only logs debug statements in development mode
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class EdgeLogger {
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = Deno.env.get('ENVIRONMENT') === 'development';
  }

  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  }

  private shouldLogDebug(): boolean {
    return this.isDevelopment;
  }

  debug(message: string, data?: unknown): void {
    if (this.shouldLogDebug()) {
      console.debug(this.formatMessage('debug', message), data ?? '');
    }
  }

  info(message: string, data?: unknown): void {
    console.info(this.formatMessage('info', message), data ?? '');
  }

  warn(message: string, data?: unknown): void {
    console.warn(this.formatMessage('warn', message), data ?? '');
  }

  error(message: string, error?: unknown): void {
    console.error(this.formatMessage('error', message), error ?? '');
  }
}

export const logger = new EdgeLogger();
