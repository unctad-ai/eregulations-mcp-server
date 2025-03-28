import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger, logger } from '../../utils/logger.js';

// Mock console methods
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'debug').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

describe('Logger', () => {
  // Save original environment variables
  const originalEnv = { ...process.env };
  
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    // Reset environment variables after each test
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
      expect(logger).toBe(Logger.getInstance());
    });
  });
  
  describe('Environment-based configuration', () => {
    it('should enable debug mode in development environment', () => {
      // Set environment to development
      process.env.NODE_ENV = 'development';
      
      // Create a new logger instance to pick up the environment change
      // This requires a hack to reset the singleton instance
      (Logger as any).instance = undefined;
      const devLogger = Logger.getInstance();
      
      // Debug mode should be enabled
      devLogger.debug('Test debug message');
      expect(console.debug).toHaveBeenCalled();
    });
    
    it('should enable debug mode when DEBUG=true', () => {
      process.env.NODE_ENV = 'production';
      process.env.DEBUG = 'true';
      
      // Reset singleton instance
      (Logger as any).instance = undefined;
      const debugLogger = Logger.getInstance();
      
      // Debug mode should be enabled
      debugLogger.debug('Test debug message');
      expect(console.debug).toHaveBeenCalled();
    });
    
    it('should enable verbose mode when LOG_LEVEL=verbose', () => {
      process.env.NODE_ENV = 'production';
      process.env.DEBUG = 'false';
      process.env.LOG_LEVEL = 'verbose';
      
      // Reset singleton instance
      (Logger as any).instance = undefined;
      const verboseLogger = Logger.getInstance();
      
      // Verbose logging should be enabled
      verboseLogger.log('Test verbose message');
      expect(console.log).toHaveBeenCalled();
    });
    
    it('should disable verbose and debug mode in production environment', () => {
      process.env.NODE_ENV = 'production';
      process.env.DEBUG = 'false';
      process.env.LOG_LEVEL = 'normal';
      
      // Reset singleton instance
      (Logger as any).instance = undefined;
      const prodLogger = Logger.getInstance();
      
      // Debug and verbose should be disabled
      prodLogger.debug('Test debug message');
      prodLogger.log('Test verbose message');
      
      expect(console.debug).not.toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalled();
    });
  });
  
  describe('Log methods', () => {
    it('should include timestamp in all log messages', () => {
      const testLogger = Logger.getInstance();
      
      // Enable verbose for testing log method
      testLogger.setVerbose(true);
      
      testLogger.log('Test message');
      testLogger.info('Test info');
      testLogger.warn('Test warning');
      testLogger.error('Test error');
      
      // All methods should include timestamp format [ISO date]
      const timestampRegex = /\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/;
      
      expect((console.log as any).mock.calls[0][0]).toMatch(timestampRegex);
      expect((console.log as any).mock.calls[1][0]).toMatch(timestampRegex);
      expect((console.warn as any).mock.calls[0][0]).toMatch(timestampRegex);
      expect((console.error as any).mock.calls[0][0]).toMatch(timestampRegex);
    });
    
    it('should include log level in appropriate methods', () => {
      const testLogger = Logger.getInstance();
      testLogger.setVerbose(true);
      testLogger.setDebug(true);
      
      testLogger.info('Test info');
      testLogger.debug('Test debug');
      testLogger.warn('Test warning');
      testLogger.error('Test error');
      
      // Check for level indicators
      expect((console.log as any).mock.calls[0][0]).toContain('[INFO]');
      expect((console.debug as any).mock.calls[0][0]).toContain('[DEBUG]');
      expect((console.warn as any).mock.calls[0][0]).toContain('[WARN]');
      expect((console.error as any).mock.calls[0][0]).toContain('[ERROR]');
    });
    
    it('should pass through all arguments to console methods', () => {
      const testLogger = Logger.getInstance();
      testLogger.setVerbose(true);
      testLogger.setDebug(true);
      
      const testObj = { test: 'value' };
      const testNum = 123;
      
      testLogger.log('Message', testObj, testNum);
      testLogger.debug('Debug', testObj, testNum);
      
      expect((console.log as any).mock.calls[0][1]).toBe('Message');
      expect((console.log as any).mock.calls[0][2]).toBe(testObj);
      expect((console.log as any).mock.calls[0][3]).toBe(testNum);
      
      expect((console.debug as any).mock.calls[0][1]).toBe('Debug');
      expect((console.debug as any).mock.calls[0][2]).toBe(testObj);
      expect((console.debug as any).mock.calls[0][3]).toBe(testNum);
    });
  });
  
  describe('Configuration methods', () => {
    it('should enable/disable verbose mode with setVerbose', () => {
      const testLogger = Logger.getInstance();
      
      // Initially verbose might be on or off depending on env
      // So explicitly disable it first
      testLogger.setVerbose(false);
      
      testLogger.log('Should not log');
      expect(console.log).not.toHaveBeenCalled();
      
      testLogger.setVerbose(true);
      testLogger.log('Should log');
      expect(console.log).toHaveBeenCalled();
    });
    
    it('should enable/disable debug mode with setDebug', () => {
      const testLogger = Logger.getInstance();
      
      // Explicitly disable debug mode
      testLogger.setDebug(false);
      
      testLogger.debug('Should not debug');
      expect(console.debug).not.toHaveBeenCalled();
      
      testLogger.setDebug(true);
      testLogger.debug('Should debug');
      expect(console.debug).toHaveBeenCalled();
    });
  });
});