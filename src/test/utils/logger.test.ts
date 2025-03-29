import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger, logger } from '../../utils/logger.js';
import net from 'node:net';

// Mock net.Socket for TCP communication
vi.mock('node:net', async (importOriginal) => {
  const actual = await importOriginal();
  
  const mockSocket = {
    connect: vi.fn((port, host, callback) => {
      if (callback) callback();
      return mockSocket;
    }),
    write: vi.fn(),
    on: vi.fn(() => mockSocket),
    end: vi.fn(),
  };
  
  return {
    ...actual,
    default: {
      ...actual.default,
      Socket: vi.fn(() => mockSocket)
    },
    Socket: vi.fn(() => mockSocket),
  };
});

// Also mock stderr for fallback logging
vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

describe('Logger', () => {
  // Save original environment variables
  const originalEnv = { ...process.env };
  
  let mockSocket: any;
  
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
    
    // Get reference to the mock socket
    mockSocket = (net.Socket as any)();
    
    // Force TCP socket mode
    process.env.DISABLE_SOCKET_LOGGING = 'false';
  });
  
  afterEach(() => {
    // Reset environment variables after each test
    process.env = { ...originalEnv };
    
    // Reset the Logger singleton for each test to get a fresh instance
    (Logger as any).instance = undefined;
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
  
  describe('Environment-based configuration', () => {
    it('should enable debug mode in development environment', () => {
      // Set environment to development
      process.env.NODE_ENV = 'development';
      
      const devLogger = Logger.getInstance();
      
      // Debug mode should be enabled
      devLogger.debug('Test debug message');
      expect(mockSocket.write).toHaveBeenCalled();
      
      // Check that the message was sent with the right level
      const lastCall = mockSocket.write.mock.calls[0][0];
      const message = JSON.parse(lastCall);
      expect(message.level).toBe('debug');
      expect(message.message).toContain('Test debug message');
    });
    
    it('should enable debug mode when DEBUG=true', () => {
      process.env.NODE_ENV = 'production';
      process.env.DEBUG = 'true';
      
      const debugLogger = Logger.getInstance();
      
      // Debug mode should be enabled
      debugLogger.debug('Test debug message');
      expect(mockSocket.write).toHaveBeenCalled();
      
      // Check that the message was sent with the right level
      const lastCall = mockSocket.write.mock.calls[0][0];
      const message = JSON.parse(lastCall);
      expect(message.level).toBe('debug');
    });
    
    it('should enable verbose mode when LOG_LEVEL=verbose', () => {
      process.env.NODE_ENV = 'production';
      process.env.DEBUG = 'false';
      process.env.LOG_LEVEL = 'verbose';
      
      const verboseLogger = Logger.getInstance();
      
      // Verbose logging should be enabled
      verboseLogger.log('Test verbose message');
      expect(mockSocket.write).toHaveBeenCalled();
      
      // Check that the message was sent with the right level
      const lastCall = mockSocket.write.mock.calls[0][0];
      const message = JSON.parse(lastCall);
      expect(message.level).toBe('info'); // log gets sent as info level
    });
    
    it('should disable verbose and debug mode in production environment', () => {
      process.env.NODE_ENV = 'production';
      process.env.DEBUG = 'false';
      process.env.LOG_LEVEL = 'normal';
      
      const prodLogger = Logger.getInstance();
      
      // Debug and verbose should be disabled
      prodLogger.debug('Test debug message');
      prodLogger.log('Test verbose message');
      
      expect(mockSocket.write).not.toHaveBeenCalled();
    });
    
    it('should use stderr when socket logging is disabled', () => {
      process.env.DISABLE_SOCKET_LOGGING = 'true';
      
      const stderrLogger = Logger.getInstance();
      stderrLogger.setVerbose(true);
      
      stderrLogger.log('Test message');
      stderrLogger.info('Test info');
      
      expect(mockSocket.write).not.toHaveBeenCalled();
      expect(process.stderr.write).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('Log methods', () => {
    it('should format messages correctly for TCP socket', () => {
      const testLogger = Logger.getInstance();
      
      // Enable verbose for testing log method
      testLogger.setVerbose(true);
      
      testLogger.log('Test message');
      testLogger.info('Test info');
      testLogger.warn('Test warning');
      testLogger.error('Test error');
      
      // Check calls to socket.write
      expect(mockSocket.write).toHaveBeenCalledTimes(4);
      
      // Parse the messages written to the socket
      const messages = mockSocket.write.mock.calls.map(call => JSON.parse(call[0]));
      
      // Check log levels
      expect(messages[0].level).toBe('info');  // log is sent as info level
      expect(messages[1].level).toBe('info');
      expect(messages[2].level).toBe('warn');
      expect(messages[3].level).toBe('error');
      
      // Check message content
      expect(messages[0].message).toContain('Test message');
      expect(messages[1].message).toContain('Test info');
      expect(messages[2].message).toContain('Test warning');
      expect(messages[3].message).toContain('Test error');
    });
    
    it('should format complex arguments correctly', () => {
      const testLogger = Logger.getInstance();
      testLogger.setVerbose(true);
      
      const testObj = { test: 'value' };
      const testNum = 123;
      
      testLogger.log('Message', testObj, testNum);
      
      // Get the message written to the socket
      const message = JSON.parse(mockSocket.write.mock.calls[0][0]);
      
      // Check that all arguments were formatted correctly
      expect(message.message).toContain('Message');
      expect(message.message).toContain(JSON.stringify(testObj));
      expect(message.message).toContain('123');
    });
    
    it('should fall back to stderr when socket logging is disabled', () => {
      // Disable socket logging
      process.env.DISABLE_SOCKET_LOGGING = 'true';
      const stderrLogger = Logger.getInstance();
      stderrLogger.setVerbose(true);
      
      stderrLogger.log('Test stderr message');
      
      // Check that stderr was used instead of socket
      expect(mockSocket.write).not.toHaveBeenCalled();
      expect(process.stderr.write).toHaveBeenCalled();
      
      // Verify message contains expected content
      const stderrMessage = (process.stderr.write as any).mock.calls[0][0];
      expect(stderrMessage).toContain('Test stderr message');
    });
  });
  
  describe('Configuration methods', () => {
    it('should enable/disable verbose mode with setVerbose', () => {
      const testLogger = Logger.getInstance();
      
      // Reset mock socket calls
      mockSocket.write.mockClear();
      
      // Explicitly disable verbose mode
      testLogger.setVerbose(false);
      
      testLogger.log('Should not log');
      expect(mockSocket.write).not.toHaveBeenCalled();
      
      testLogger.setVerbose(true);
      testLogger.log('Should log');
      expect(mockSocket.write).toHaveBeenCalled();
    });
    
    it('should enable/disable debug mode with setDebug', () => {
      const testLogger = Logger.getInstance();
      
      // Reset mock socket calls
      mockSocket.write.mockClear();
      
      // Explicitly disable debug mode
      testLogger.setDebug(false);
      
      testLogger.debug('Should not debug');
      expect(mockSocket.write).not.toHaveBeenCalled();
      
      testLogger.setDebug(true);
      testLogger.debug('Should debug');
      expect(mockSocket.write).toHaveBeenCalled();
    });
  });
});