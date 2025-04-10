import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createServer } from "../mcp-server.js";
import { ERegulationsApi } from "../services/eregulations-api.js";
import {
  PromptName,
  PROMPT_TEMPLATES,
} from "../mcp-capabilities/prompts/templates.js";
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  ListProceduresSchema,
  GetProcedureDetailsSchema,
  GetProcedureStepSchema,
  SearchProceduresSchema,
  ToolName,
} from "../mcp-capabilities/tools/schemas.js";

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
  dispose: vi.fn(),
};

vi.mock("../services/eregulations-api.js", () => ({
  ERegulationsApi: vi.fn().mockImplementation(() => mockApiMethods),
}));

// Create mock handlers
const mockHandlers = [
  {
    name: ToolName.LIST_PROCEDURES,
    description: "List all available procedures",
    inputSchema: { type: "object", properties: {} },
    inputSchemaDefinition: ListProceduresSchema,
    handler: vi.fn().mockImplementation(() =>
      Promise.resolve({
        content: [{ type: "text", text: "list of procedures" }],
      })
    ),
  },
  {
    name: ToolName.GET_PROCEDURE_DETAILS,
    description: "Get detailed information about a procedure",
    inputSchema: {
      type: "object",
      properties: { procedureId: { type: "number" } },
      required: ["procedureId"],
    },
    inputSchemaDefinition: GetProcedureDetailsSchema,
    handler: vi.fn().mockImplementation((args) => {
      if (!args.procedureId) {
        throw new Error("procedureId is required");
      }
      return Promise.resolve({
        content: [
          { type: "text", text: `procedure details for ${args.procedureId}` },
        ],
      });
    }),
  },
  {
    name: ToolName.GET_PROCEDURE_STEP,
    description: "Get information about a specific step",
    inputSchema: {
      type: "object",
      properties: {
        procedureId: { type: "number" },
        stepId: { type: "number" },
      },
      required: ["procedureId", "stepId"],
    },
    inputSchemaDefinition: GetProcedureStepSchema,
    handler: vi.fn().mockImplementation((args) => {
      if (!args.procedureId) {
        throw new Error("procedureId is required");
      }
      if (!args.stepId) {
        throw new Error("stepId is required");
      }
      return Promise.resolve({
        content: [
          {
            type: "text",
            text: `step details for procedure ${args.procedureId}, step ${args.stepId}`,
          },
        ],
      });
    }),
  },
  {
    name: ToolName.SEARCH_PROCEDURES,
    description: "Search for procedures",
    inputSchema: {
      type: "object",
      properties: { keyword: { type: "string" } },
      required: ["keyword"],
    },
    inputSchemaDefinition: SearchProceduresSchema,
    handler: vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "search results" }],
    }),
  },
];

// Mock the tool handlers
vi.mock("../mcp-capabilities/tools/handlers/index.js", () => ({
  createHandlers: vi.fn().mockImplementation(() => mockHandlers),
}));

// Mock the request schemas with method property
vi.mock("@modelcontextprotocol/sdk/types.js", () => ({
  CallToolRequestSchema: { method: "tools/call" },
  GetPromptRequestSchema: { method: "prompts/get" },
  ListPromptsRequestSchema: { method: "prompts/list" },
  ListToolsRequestSchema: { method: "tools/list" },
}));

// Mock the MCP SDK McpServer and capture tool registrations
const mockToolRegistrations = new Map<string, any>();
vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
  McpServer: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    close: vi.fn(),
    tool: (name: string, schema: any, handler: any) => {
      mockToolRegistrations.set(name, { schema, handler });
    },
  })),
}));

// Mock the logger
vi.mock("../utils/logger.js", () => ({
  logger: {
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Declare server and handlers variables
let server: McpServer;
let handlers: any[]; // Keep for now, but won't be assigned

describe("MCP Server", () => {
  const mockBaseUrl = "http://mock-eregulations-api.test";

  beforeEach(() => {
    vi.clearAllMocks();
    mockToolRegistrations.clear();
    // Assign server in beforeEach
    server = createServer().server;
    // handlers = []; // handlers is no longer returned
  });

  describe("createServer", () => {
    it("should create server with correct configuration", () => {
      // server is assigned in beforeEach
      expect(server).toBeDefined();
      // Check if the constructor was called (using the mock)
      expect(McpServer).toHaveBeenCalledWith({
        name: "eregulations-mcp-server",
        version: "1.0.0",
      });
    });

    it("should pass baseUrl to the ERegulationsApi instance when provided", () => {
      createServer(mockBaseUrl);
      expect(mockApiMethods.setBaseUrl).toHaveBeenCalledWith(mockBaseUrl);
    });

    it("should not pass baseUrl to the ERegulationsApi when not provided", () => {
      createServer();
      expect(mockApiMethods.setBaseUrl).not.toHaveBeenCalled();
    });
  });

  describe("McpServer tool registration", () => {
    /* REMOVED add tool test
    it("should register the 'add' tool", () => {
      // createServer() is called in beforeEach, which should register the tool
      expect(mockToolRegistrations.has("add")).toBe(true);
      const addTool = mockToolRegistrations.get("add");
      expect(addTool.schema).toBeDefined();
      expect(addTool.handler).toBeInstanceOf(Function);
    });
    */

    it("should register the eRegulations tools", () => {
      // createServer() is called in beforeEach
      const expectedTools = [
        "listProcedures",
        "getProcedureDetails",
        "getProcedureStep",
        "searchProcedures",
      ];
      expectedTools.forEach((toolName) => {
        expect(
          mockToolRegistrations.has(toolName),
          `Tool ${toolName} should be registered`
        ).toBe(true);
        const registeredTool = mockToolRegistrations.get(toolName);
        expect(
          registeredTool.schema,
          `Schema for ${toolName} should be defined`
        ).toBeDefined();
        expect(
          registeredTool.schema,
          `Schema for ${toolName} should be an object (shape)`
        ).toBeInstanceOf(Object);
        expect(
          registeredTool.handler,
          `Handler for ${toolName} should be a function`
        ).toBeInstanceOf(Function);
      });
    });

    // TODO: Add tests here later when eRegulations tools are re-added using server.tool()
  });

  // --- COMMENT OUT tests relying on the old setRequestHandler structure ---
  // describe("MCP request handler registration", () => {
  //   it("should register all required MCP request handlers", () => { ... });
  //   it("should register tools/list handler", () => { ... });
  //   it("should register tools/call handler", () => { ... });
  //   it("should register prompts/list handler", () => { ... });
  //   it("should register prompts/get handler", () => { ... });
  // });

  // describe("MCP handler implementations", () => {
  //   it("should return list of tools in ListToolsRequest handler", async () => { ... });
  //   it("should handle CallToolRequest for valid tools", async () => { ... });
  //   it("should throw error for unknown tool in CallToolRequest", async () => { ... });
  //   it("should return list of prompts in ListPromptsRequest handler", async () => { ... });
  //   it("should return prompt content in GetPromptRequest handler", async () => { ... });
  //   it("should throw error for unknown prompt in GetPromptRequest", async () => { ... });
  // });

  // describe("prompts", () => {
  //   it("should define all required prompts", () => { ... });
  // });
});
