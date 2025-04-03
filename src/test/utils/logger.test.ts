import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Force test environment to disable socket in Logger
process.env.VITEST = 'true';

// Now import the Logger after mocking
import { Logger, logger } from '../../utils/logger.js';

describe('Logger', () => {
  // Save original environment variables 
  const originalEnv = { ...process.env };
  
  beforeEach(() => {
    // Force socket logging to be disabled to avoid using net module in tests
    process.env.DISABLE_SOCKET_LOGGING = 'true';
    
    // Reset the Logger singleton for each test
    (Logger as any).instance = undefined;
  });
  
  afterEach(() => {
    // Reset environment variables
    process.env = { ...originalEnv };
  });
  
  describe('Singleton pattern', () => {
    it('should return the same instance when getInstance is called multiple times', () => {
      const instance1 = Logger.getInstance();
      const instance2 = Logger.getInstance();
      
      expect(instance1).toBe(instance2);
    });
    
    it('should expose a default logger instance', () => {
      expect(logger).toBeDefined();
      expect(logger).toEqual(Logger.getInstance());
    });
  });
});