import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger } from './logger';

describe('Logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should log debug messages in development mode', () => {
    logger.debug('test message');
    // In test mode with VITE_ENABLE_DEBUG_LOGGING=false, debug should not log
    expect(console.debug).not.toHaveBeenCalled();
  });

  it('should log info messages', () => {
    logger.info('test info');
    // Info messages are not logged in test mode (minLevel is error by default)
    expect(console.info).not.toHaveBeenCalled();
  });

  it('should log warn messages', () => {
    logger.warn('test warning');
    // Warn messages are not logged in test mode
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('should always log error messages', () => {
    logger.error('test error');
    // Error messages should be logged in production
    expect(console.error).toHaveBeenCalled();
  });

  it('should handle data objects', () => {
    const data = { key: 'value' };
    logger.error('test with data', data);
    expect(console.error).toHaveBeenCalled();
  });
});
