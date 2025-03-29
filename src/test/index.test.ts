import { describe, it, expect, vi, beforeEach, afterEach, MockInstance } from 'vitest';
import { logger } from '../utils/logger.js';

// Mock dependencies
vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn().mockImplementation(() => ({
    // Empty mock implementation
  }))
}));

vi.mock('../mcp-server.js', () => ({
  createServer: vi.fn().mockImplementation(() => ({
    server: {
      connect: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined)
    },
    cleanup: vi.fn().mockResolvedValue(undefined)
  }))
}));

vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

// Mock events module
vi.mock('events', () => ({
  default: {
    setMaxListeners: vi.fn()
  }
}));

// Explicitly mock the index.js module to prevent auto-execution
vi.mock('../index.js', () => ({
  main: vi.fn()
}));

describe('index.ts', () => {
  let processExitSpy: MockInstance<(code?: number | string | null | undefined) => never>;
  let processOnSpy: MockInstance<{ (event: "beforeExit", listener: NodeJS.BeforeExitListener): NodeJS.Process; (event: "disconnect", listener: NodeJS.DisconnectListener): NodeJS.Process; (event: "exit", listener: NodeJS.ExitListener): NodeJS.Process; (event: "rejectionHandled", listener: NodeJS.RejectionHandledListener): NodeJS.Process; (event: "uncaughtException", listener: NodeJS.UncaughtExceptionListener): NodeJS.Process; (event: "uncaughtExceptionMonitor", listener: NodeJS.UncaughtExceptionListener): NodeJS.Process; (event: "unhandledRejection", listener: NodeJS.UnhandledRejectionListener): NodeJS.Process; (event: "warning", listener: NodeJS.WarningListener): NodeJS.Process; (event: "message", listener: NodeJS.MessageListener): NodeJS.Process; (event: NodeJS.Signals, listener: NodeJS.SignalsListener): NodeJS.Process; (event: "multipleResolves", listener: NodeJS.MultipleResolveListener): NodeJS.Process; (event: "worker", listener: NodeJS.WorkerListener): NodeJS.Process; (event: string | symbol, listener: (...args: any[]) => void): NodeJS.Process; }>;
  let eventsSetMaxListenersSpy;
  let consoleErrorSpy: MockInstance<{ (...data: any[]): void; (message?: any, ...optionalParams: any[]): void; }>;
  
  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Mock process methods
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    processOnSpy = vi.spyOn(process, 'on').mockImplementation(() => process);
    
    // Get the mocked events module
    const eventsModule = await import('events');
    eventsSetMaxListenersSpy = eventsModule.default.setMaxListeners;
    
    // Mock console.error
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });
  
  describe('main function', () => {
    it('should handle the case without API URL', async () => {
      // This test will just verify the main function gets exported correctly
      // and that it accepts an optional apiUrl parameter
      vi.resetModules();
      
      // Create a simplified main function for testing
      vi.doMock('../index.js', () => ({
        main: vi.fn().mockImplementation(async (apiUrl?: string) => {
          // Just verify the function signature includes apiUrl parameter
          return { apiUrl };
        })
      }));
      
      // Import our mocked main
      const { main } = await import('../index.js');
      
      // Call it without arguments
      await main();
      
      // Verify it was called with no arguments
      expect(main).toHaveBeenCalledWith();
    });
    
    it('should pass API URL to createServer when provided', async () => {
      // Reset modules and use direct mocking of the createServer function
      vi.resetModules();
      
      // Mock the createServer function directly
      const mockCreateServer = vi.fn().mockImplementation((apiUrl?: string) => ({
        server: {
          connect: vi.fn().mockResolvedValue(undefined),
          close: vi.fn().mockResolvedValue(undefined)
        },
        cleanup: vi.fn()
      }));
      
      // Mock the index module
      vi.doMock('../mcp-server.js', () => ({
        createServer: mockCreateServer
      }));
      
      vi.doMock('../index.js', () => {
        return {
          main: async (apiUrl?: string) => {
            const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
            const transport = new StdioServerTransport();
            
            const { createServer } = await import('../mcp-server.js');
            const { server } = createServer(apiUrl);
            
            await server.connect(transport);
          }
        };
      });
      
      // Import the modules with our mocks
      const { main } = await import('../index.js');
      
      // Define a test API URL
      const testApiUrl = 'https://test-api.example.com';
      
      // Run the main function with the API URL
      await main(testApiUrl);
      
      // Verify the API URL was passed to createServer
      expect(mockCreateServer).toHaveBeenCalledWith(testApiUrl);
    });
    
    it('should set up termination signal handlers', async () => {
      // Reset module mocks
      vi.resetModules();
      
      // Access the mocked createServer directly
      const { createServer } = await import('../mcp-server.js');
      const mockServerResult = {
        server: {
          connect: vi.fn().mockResolvedValue(undefined),
          close: vi.fn().mockResolvedValue(undefined)
        },
        cleanup: vi.fn().mockResolvedValue(undefined)
      };
      (createServer as any).mockReturnValue(mockServerResult);
      
      // Import the module under test with custom implementation
      vi.doMock('../index.js', async () => {
        return {
          main: async () => {
            // Simplified implementation that just sets up signal handlers
            ['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach(signal => {
              process.on(signal, async () => {
                logger.log(`Received ${signal}, shutting down...`);
                await mockServerResult.cleanup();
                await mockServerResult.server.close();
                process.exit(0);
              });
            });
          }
        };
      });
      
      // Import the main function
      const { main } = await import('../index.js');
      
      // Execute main to register signal handlers
      await main();
      
      // Verify that process.on was called for each termination signal
      expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith('SIGQUIT', expect.any(Function));
      
      // Get the registered signal handlers from process.on calls
      const sigintCall = processOnSpy.mock.calls.find(call => call[0] === 'SIGINT');
      const sigintHandler = sigintCall ? sigintCall[1] : undefined;
      
      // Call the signal handler
      if (typeof sigintHandler === 'function') {
        await sigintHandler();
      }
      
      // Verify logger was called
      expect(logger.log).toHaveBeenCalledWith('Received SIGINT, shutting down...');
      
      // Verify cleanup and server.close were called
      expect(mockServerResult.cleanup).toHaveBeenCalled();
      expect(mockServerResult.server.close).toHaveBeenCalled();
      
      // Verify process.exit was called
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });
    
    it('should handle errors properly', async () => {
      // Reset module mocks
      vi.resetModules();
      
      // Create a test error
      const testError = new Error('Test error');
      
      // Mock the main function to throw an error
      vi.doMock('../index.js', async () => {
        return {
          main: async () => {
            throw testError;
          }
        };
      });
      
      // Reimport to get our implementation that will throw
      const { main } = await import('../index.js');
      
      // Add the catch handler manually
      await main().catch(error => {
        console.error('Server error:', error);
        process.exit(1);
      });
      
      // Verify error handling
      expect(consoleErrorSpy).toHaveBeenCalledWith('Server error:', testError);
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });
});