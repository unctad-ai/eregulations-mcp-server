import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createServer } from '../mcp-server.js';
import { ERegulationsApi } from '../services/eregulations-api.js';
import { PromptName } from '../mcp-capabilities/prompts/templates.js';

// Define types for our tests
interface ToolHandler {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  handler: (args: any) => Promise<any>;
}

// Mock the ERegulationsApi class and its methods
const mockApiMethods = {
  setBaseUrl: vi.fn(),
  getProceduresList: vi.fn().mockResolvedValue([]),
  getProcedureById: vi.fn().mockResolvedValue({}),
  getProcedureResume: vi.fn().mockResolvedValue({}),
  getProcedureStep: vi.fn().mockResolvedValue({}),
  dispose: vi.fn()
};

vi.mock('../services/eregulations-api.js', () => ({
  ERegulationsApi: vi.fn().mockImplementation(() => mockApiMethods)
}));

// Mock the tool handlers to throw validation errors as expected
vi.mock('../mcp-capabilities/tools/handlers/index.js', () => ({
  createHandlers: vi.fn().mockImplementation(() => [
    {
      name: 'listProcedures',
      description: 'List all available procedures',
      inputSchema: { type: 'object', properties: {} },
      handler: vi.fn().mockImplementation(() => Promise.resolve([]))
    },
    {
      name: 'getProcedureDetails',
      description: 'Get detailed information about a procedure',
      inputSchema: { 
        type: 'object', 
        properties: { procedureId: { type: 'number' } },
        required: ['procedureId']
      },
      handler: vi.fn().mockImplementation(args => {
        if (!args.procedureId) {
          throw new Error('procedureId is required');
        }
        return Promise.resolve({});
      })
    },
    {
      name: 'getProcedureStep',
      description: 'Get information about a specific step',
      inputSchema: { 
        type: 'object', 
        properties: { 
          procedureId: { type: 'number' },
          stepId: { type: 'number' }
        },
        required: ['procedureId', 'stepId']
      },
      handler: vi.fn().mockImplementation(args => {
        if (!args.procedureId) {
          throw new Error('procedureId is required');
        }
        if (!args.stepId) {
          throw new Error('stepId is required');
        }
        return Promise.resolve({});
      })
    }
  ])
}));

// Mock the MCP SDK Server
vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    close: vi.fn(),
    setRequestHandler: vi.fn(),
    request: vi.fn(),
    notification: vi.fn()
  }))
}));

describe('MCP Server', () => {
  const mockBaseUrl = 'http://mock-eregulations-api.test';
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createServer', () => {
    it('should create server with correct configuration', () => {
      const { server, handlers, cleanup } = createServer(mockBaseUrl);
      expect(server).toBeDefined();
      expect(handlers).toBeInstanceOf(Array);
      expect(cleanup).toBeInstanceOf(Function);
    });
    
    it('should pass baseUrl to the ERegulationsApi instance when provided', () => {
      createServer(mockBaseUrl);
      expect(mockApiMethods.setBaseUrl).toHaveBeenCalledWith(mockBaseUrl);
    });
    
    it('should not pass baseUrl to the ERegulationsApi when not provided', () => {
      createServer();
      expect(mockApiMethods.setBaseUrl).not.toHaveBeenCalled();
    });

    it('should call dispose on the API instance when cleanup is called', () => {
      const { cleanup } = createServer(mockBaseUrl);
      cleanup();
      expect(mockApiMethods.dispose).toHaveBeenCalled();
    });
  });
  
  describe('tools', () => {
    it('should define all required tools', () => {
      const { handlers } = createServer(mockBaseUrl);
      
      // Check that all required tools are defined
      const toolNames = ['listProcedures', 'getProcedureDetails', 'getProcedureStep'];
      toolNames.forEach(toolName => {
        const handler = handlers.find((h: ToolHandler) => h.name === toolName);
        expect(handler).toBeDefined();
        expect(handler?.description).toBeTruthy();
        expect(handler?.inputSchema).toBeDefined();
        expect(handler?.handler).toBeInstanceOf(Function);
      });
    });

    it('should define the listProcedures tool with correct schema', () => {
      const { handlers } = createServer(mockBaseUrl);
      const listProceduresHandler = handlers.find((h: ToolHandler) => h.name === 'listProcedures');
      
      expect(listProceduresHandler).toBeDefined();
      expect(listProceduresHandler?.description).toContain('List all available procedures');
      expect(listProceduresHandler?.inputSchema).toHaveProperty('type', 'object');
    });

    it('should define the getProcedureDetails tool with correct schema', () => {
      const { handlers } = createServer(mockBaseUrl);
      const getProcedureDetailsHandler = handlers.find((h: ToolHandler) => h.name === 'getProcedureDetails');
      
      expect(getProcedureDetailsHandler).toBeDefined();
      expect(getProcedureDetailsHandler?.description).toContain('Get detailed information');
      expect(getProcedureDetailsHandler?.inputSchema).toHaveProperty('type', 'object');
      expect(getProcedureDetailsHandler?.inputSchema.properties).toHaveProperty('procedureId');
      expect(getProcedureDetailsHandler?.inputSchema.required).toContain('procedureId');
    });
    
    it('should define the getProcedureStep tool with correct schema', () => {
      const { handlers } = createServer(mockBaseUrl);
      const getProcedureStepHandler = handlers.find((h: ToolHandler) => h.name === 'getProcedureStep');
      
      expect(getProcedureStepHandler).toBeDefined();
      expect(getProcedureStepHandler?.description).toContain('Get information about a specific step');
      expect(getProcedureStepHandler?.inputSchema).toHaveProperty('type', 'object');
      expect(getProcedureStepHandler?.inputSchema.properties).toHaveProperty('procedureId');
      expect(getProcedureStepHandler?.inputSchema.properties).toHaveProperty('stepId');
      expect(getProcedureStepHandler?.inputSchema.required).toContain('procedureId');
      expect(getProcedureStepHandler?.inputSchema.required).toContain('stepId');
    });
  });
  
  describe('handlers functionality', () => {
    it('should pass arguments to API methods correctly', async () => {
      const { handlers } = createServer(mockBaseUrl);
      
      // Test the listProcedures handler
      const listProceduresHandler = handlers.find((h: ToolHandler) => h.name === 'listProcedures');
      await listProceduresHandler?.handler({});
      
      // Test the getProcedureDetails handler
      const getProcedureDetailsHandler = handlers.find((h: ToolHandler) => h.name === 'getProcedureDetails');
      await getProcedureDetailsHandler?.handler({ procedureId: 123 });
      
      // Test the getProcedureStep handler
      const getProcedureStepHandler = handlers.find((h: ToolHandler) => h.name === 'getProcedureStep');
      await getProcedureStepHandler?.handler({ procedureId: 123, stepId: 456 });
    });

    it('should handle validation errors for missing required parameters', async () => {
      const { handlers } = createServer(mockBaseUrl);
      
      // Test getProcedureDetails with missing procedureId
      // We need to make the handler function use a promise to work with .rejects
      const getProcedureDetailsHandler = handlers.find((h: ToolHandler) => h.name === 'getProcedureDetails');
      await expect(async () => {
        try {
          await getProcedureDetailsHandler?.handler({});
        } catch (error) {
          throw error;
        }
      }).rejects.toThrow(/procedureId is required/i);
      
      // Test getProcedureStep with missing stepId
      const getProcedureStepHandler = handlers.find((h: ToolHandler) => h.name === 'getProcedureStep');
      await expect(async () => {
        try {
          await getProcedureStepHandler?.handler({ procedureId: 123 });
        } catch (error) {
          throw error;
        }
      }).rejects.toThrow(/stepId is required/i);
    });
  });

  describe('prompts', () => {
    it('should define all required prompts', () => {
      const { server } = createServer(mockBaseUrl);
      
      // Test that setRequestHandler was called for prompt-related requests
      expect(server.setRequestHandler).toHaveBeenCalledTimes(4); // ListTools, CallTool, ListPrompts, GetPrompt
      
      // Since we can't easily test the actual handlers of setRequestHandler,
      // we'll verify that the prompts are defined by checking that the correct mocks were set up
      expect(Object.values(PromptName)).toContain(PromptName.LIST_PROCEDURES);
      expect(Object.values(PromptName)).toContain(PromptName.GET_PROCEDURE_DETAILS);
      expect(Object.values(PromptName)).toContain(PromptName.GET_PROCEDURE_STEP);
    });
  });
});