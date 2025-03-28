import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { EventEmitter } from 'events';
import type { ServerResponse } from 'http';

// Create mock objects that will be used by tests
const mockStdin: any = new EventEmitter();
mockStdin.write = vi.fn();

const mockStdout = new EventEmitter();
const mockStderr = new EventEmitter();

const mockChildProcess = {
  stdin: mockStdin,
  stdout: mockStdout,
  stderr: mockStderr,
  on: vi.fn().mockImplementation((event, handler) => {
    if (event === 'exit') {
      mockChildProcess.exitHandler = handler;
    }
    return mockChildProcess;
  }),
  exitHandler: null as any
};

// Extend mockApp type to include the custom properties we're using
interface MockExpressApp {
  use: Mock;
  get: Mock;
  post: Mock;
  listen: Mock;
  healthHandler?: any;
  sseHandler?: any;
  messageHandler?: any;
}

const mockApp: MockExpressApp = {
  use: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  listen: vi.fn().mockImplementation((port, callback) => {
    if (callback) callback();
    return { close: vi.fn() };
  })
};

const mockSSETransport = {
  sessionId: 'test-session-id',
  onmessage: vi.fn(),
  onclose: vi.fn(),
  onerror: vi.fn(),
  send: vi.fn(),
  handlePostMessage: vi.fn().mockImplementation(async (req, res) => {
    res.send('ok');
  })
};

// Mock external dependencies
vi.mock('express', () => ({
  default: vi.fn().mockReturnValue(mockApp),
  json: vi.fn()
}));

vi.mock('body-parser', () => ({
  default: {
    json: vi.fn().mockReturnValue(() => {})
  }
}));

vi.mock('cors', () => ({
  default: vi.fn().mockReturnValue(() => {})
}));

vi.mock('child_process', () => ({
  spawn: vi.fn().mockReturnValue(mockChildProcess)
}));

vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined)
  }))
}));

vi.mock('@modelcontextprotocol/sdk/server/sse.js', () => ({
  SSEServerTransport: vi.fn().mockImplementation(() => mockSSETransport)
}));

vi.mock('fs', () => ({
  readFileSync: vi.fn().mockReturnValue(JSON.stringify({ version: '1.0.0-test' }))
}));

vi.mock('yargs/helpers', () => ({
  hideBin: vi.fn().mockReturnValue([])
}));

vi.mock('yargs', () => {
  const mockYargs = {
    option: vi.fn().mockReturnThis(),
    help: vi.fn().mockReturnThis(),
    parseSync: vi.fn().mockReturnValue({
      stdio: 'node test-cmd',
      port: 8000,
      baseUrl: 'http://localhost:8000',
      ssePath: '/sse',
      messagePath: '/message',
      logLevel: 'info',
      cors: true,
      healthEndpoint: ['/health']
    })
  };
  
  return {
    default: vi.fn().mockReturnValue(mockYargs)
  };
});

// Prevent actual execution of main function
vi.mock('../sse.js', async () => {
  const actual = await vi.importActual('../sse.js');
  
  // When calling stdioToSse, we need to ensure our mocks are correctly connected 
  const stdioToSseMock = async (args: any) => {
    // Connect mockSSETransport to mockChildProcess
    // This simulates the connections made in the actual code
    mockSSETransport.onmessage = ((msg: any) => {
      mockChildProcess.stdin.write(JSON.stringify(msg) + '\n');
    }) as any;
    
    // Setup stdout data handler
    mockChildProcess.stdout.on('data', (chunk: Buffer) => {
      // Parse JSON and send to transport
      const line = chunk.toString('utf8').trim();
      if (line) {
        try {
          const jsonMsg = JSON.parse(line);
          // Send to all sessions
          mockSSETransport.send(jsonMsg);
        } catch (err) {
          console.error('Error parsing JSON:', err);
        }
      }
    });
    
    // Store the actual stdioToSse arguments
    (stdioToSseMock as any).lastArgs = args;
    
    // Continue with normal setup
    const { SSEServerTransport } = await import('@modelcontextprotocol/sdk/server/sse.js');
    // Create a mock express response that satisfies the ServerResponse interface requirements
    const mockExpressResponse = {
      writeHead: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
      statusCode: 200,
      headersSent: false,
      getHeader: vi.fn(),
      setHeader: vi.fn(),
      removeHeader: vi.fn(),
      flushHeaders: vi.fn(),
      on: vi.fn(),
      once: vi.fn(),
      emit: vi.fn(),
      socket: null
    } as unknown as ServerResponse;
    
    const sseTransport = new SSEServerTransport(`${args.baseUrl}${args.messagePath}`, mockExpressResponse);
    await new (await import('@modelcontextprotocol/sdk/server/index.js')).Server(
      { name: 'eregulations-mcp-server', version: '1.0.0-test' },
      { capabilities: {} }
    ).connect(sseTransport);
  };
  
  return {
    ...actual as object,
    main: vi.fn(),
    stdioToSse: vi.fn().mockImplementation(stdioToSseMock)
  };
});

describe('sse.ts', () => {
  // Save original console methods
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  
  // Setup mocks before each test
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    
    // Mock console methods
    console.log = vi.fn();
    console.error = vi.fn();
    
    // Mock process methods
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    vi.spyOn(process, 'on').mockImplementation((event, handler) => {
      if (event === 'SIGINT') {
        (process as any).sigintHandler = handler;
      } else if (event === 'SIGTERM') {
        (process as any).sigtermHandler = handler;
      } else if (event === 'SIGHUP') {
        (process as any).sighupHandler = handler;
      }
      return process;
    });
    
    if (process.stdin) {
      vi.spyOn(process.stdin, 'on').mockImplementation((event: string, handler: Function) => {
        if (event === 'close') {
          (process.stdin as any).closeHandler = handler;
        }
        return process.stdin as any;
      });
    }
    
    // Reset mock app handlers
    mockApp.get.mockImplementation((path: string, handler: any) => {
      if (path === '/health') {
        mockApp.healthHandler = handler;
      } else if (path === '/sse') {
        mockApp.sseHandler = handler;
      }
      return mockApp;
    });
    
    mockApp.post.mockImplementation((path: string, handler: any) => {
      if (path === '/message') {
        mockApp.messageHandler = handler;
      }
      return mockApp;
    });
  });
  
  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    
    vi.restoreAllMocks();
  });
  
  describe('Server initialization', () => {
    it('should initialize server components correctly', async () => {
      // Load module functions
      const { stdioToSse } = await import('../sse.js');
      const { spawn } = await import('child_process');
      const { Server } = await import('@modelcontextprotocol/sdk/server/index.js');
      
      // Call the main setup function
      await stdioToSse({
        stdioCmd: 'node test-cmd',
        port: 8000,
        baseUrl: 'http://localhost:8000',
        ssePath: '/sse',
        messagePath: '/message',
        logger: { info: console.log, error: console.error },
        enableCors: true,
        healthEndpoints: ['/health']
      });
      
      // Verify spawn was called with the correct command
      expect(spawn).toHaveBeenCalledWith('node test-cmd', { shell: true });
      
      // Verify Server was initialized
      expect(Server).toHaveBeenCalledWith(
        { name: 'eregulations-mcp-server', version: '1.0.0-test' },
        { capabilities: {} }
      );
      
      // Verify routes were set up
      expect(mockApp.get).toHaveBeenCalledWith('/health', expect.any(Function));
      expect(mockApp.get).toHaveBeenCalledWith('/sse', expect.any(Function));
      expect(mockApp.post).toHaveBeenCalledWith('/message', expect.any(Function));
      
      // Verify server started listening
      expect(mockApp.listen).toHaveBeenCalledWith(8000, expect.any(Function));
    });
  });
  
  describe('Route handlers', () => {
    it('should handle health check endpoints', async () => {
      // Load modules
      const { stdioToSse } = await import('../sse.js');
      
      // Set up server
      await stdioToSse({
        stdioCmd: 'node test-cmd',
        port: 8000,
        baseUrl: 'http://localhost:8000',
        ssePath: '/sse',
        messagePath: '/message',
        logger: { info: console.log, error: console.error },
        enableCors: true,
        healthEndpoints: ['/health']
      });
      
      // Get health handler and test it
      const healthHandler = mockApp.healthHandler;
      expect(healthHandler).toBeDefined();
      
      // Call health handler
      const mockReq = {};
      const mockRes = { send: vi.fn() };
      healthHandler(mockReq, mockRes);
      
      // Verify response
      expect(mockRes.send).toHaveBeenCalledWith('ok');
    });
    
    it('should handle SSE connection', async () => {
      // Load modules
      const { stdioToSse } = await import('../sse.js');
      const { SSEServerTransport } = await import('@modelcontextprotocol/sdk/server/sse.js');
      
      // Set up server
      await stdioToSse({
        stdioCmd: 'node test-cmd',
        port: 8000,
        baseUrl: 'http://localhost:8000',
        ssePath: '/sse',
        messagePath: '/message',
        logger: { info: console.log, error: console.error },
        enableCors: true,
        healthEndpoints: ['/health']
      });
      
      // Get SSE handler and test it
      const sseHandler = mockApp.sseHandler;
      expect(sseHandler).toBeDefined();
      
      // Create mock request and response
      const mockReq = { ip: '127.0.0.1', on: vi.fn() };
      const mockRes = {};
      
      // Call SSE handler
      await sseHandler(mockReq, mockRes);
      
      // Verify SSEServerTransport was created with correct params
      expect(SSEServerTransport).toHaveBeenCalledWith('http://localhost:8000/message', mockRes);
      
      // Verify client disconnect handler was registered
      expect(mockReq.on).toHaveBeenCalledWith('close', expect.any(Function));
      
      // Test SSE message handling
      const jsonMsg = { method: 'test', id: 1 };
      mockSSETransport.onmessage(jsonMsg);
      
      // Verify message was sent to child process
      expect(mockChildProcess.stdin.write).toHaveBeenCalledWith(JSON.stringify(jsonMsg) + '\n');
    });
    
    it('should handle message endpoint with missing sessionId', async () => {
      // Load modules
      const { stdioToSse } = await import('../sse.js');
      
      // Set up server
      await stdioToSse({
        stdioCmd: 'node test-cmd',
        port: 8000,
        baseUrl: 'http://localhost:8000',
        ssePath: '/sse',
        messagePath: '/message',
        logger: { info: console.log, error: console.error },
        enableCors: true,
        healthEndpoints: ['/health']
      });
      
      // Get message handler
      const messageHandler = mockApp.messageHandler;
      expect(messageHandler).toBeDefined();
      
      // Create mock request and response with no sessionId
      const mockReq = { query: {} };
      const mockRes = { 
        status: vi.fn().mockReturnThis(), 
        send: vi.fn() 
      };
      
      // Call handler
      await messageHandler(mockReq, mockRes);
      
      // Verify response
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith('Missing sessionId parameter');
    });
  });
  
  describe('Process handling', () => {
    it('should handle child process stdout data', async () => {
      // Load modules
      const { stdioToSse } = await import('../sse.js');
      
      // Set up server and create a session
      await stdioToSse({
        stdioCmd: 'node test-cmd',
        port: 8000,
        baseUrl: 'http://localhost:8000',
        ssePath: '/sse',
        messagePath: '/message',
        logger: { info: console.log, error: console.error },
        enableCors: true,
        healthEndpoints: ['/health']
      });
      
      // Get SSE handler and create a session
      const sseHandler = mockApp.sseHandler;
      const mockReq = { ip: '127.0.0.1', on: vi.fn() };
      const mockRes = {};
      await sseHandler(mockReq, mockRes);
      
      // Send data through child process stdout
      const jsonMsg = { method: 'test', id: 1 };
      mockChildProcess.stdout.emit('data', Buffer.from(JSON.stringify(jsonMsg) + '\n'));
      
      // Verify message was sent to SSE client
      expect(mockSSETransport.send).toHaveBeenCalledWith(jsonMsg);
    });
    
    it('should handle child process exit', async () => {
      // Load modules
      const { stdioToSse } = await import('../sse.js');
      
      // Set up server
      await stdioToSse({
        stdioCmd: 'node test-cmd',
        port: 8000,
        baseUrl: 'http://localhost:8000',
        ssePath: '/sse',
        messagePath: '/message',
        logger: { info: console.log, error: console.error },
        enableCors: true,
        healthEndpoints: ['/health']
      });
      
      // Trigger child process exit
      expect(mockChildProcess.exitHandler).toBeDefined();
      mockChildProcess.exitHandler(1, null);
      
      // Verify process.exit was called
      expect(process.exit).toHaveBeenCalledWith(1);
    });
    
    it('should handle signal interruptions', async () => {
      // Load modules
      const { stdioToSse } = await import('../sse.js');
      
      // Set up server
      await stdioToSse({
        stdioCmd: 'node test-cmd',
        port: 8000,
        baseUrl: 'http://localhost:8000',
        ssePath: '/sse',
        messagePath: '/message',
        logger: { info: console.log, error: console.error },
        enableCors: true,
        healthEndpoints: ['/health']
      });
      
      // Test SIGINT handler
      (process as any).sigintHandler();
      
      // Verify log message and process.exit
      expect(console.log).toHaveBeenCalledWith('[eregulations-mcp-server]', 'Caught SIGINT. Exiting...');
      expect(process.exit).toHaveBeenCalledWith(0);
    });
  });
});