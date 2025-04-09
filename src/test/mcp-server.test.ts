import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
    name: "listProcedures",
    description: "List all available procedures",
    inputSchema: { type: "object", properties: {} },
    handler: vi.fn().mockImplementation(() =>
      Promise.resolve({
        content: [{ type: "text", text: "list of procedures" }],
      })
    ),
  },
  {
    name: "getProcedureDetails",
    description: "Get detailed information about a procedure",
    inputSchema: {
      type: "object",
      properties: { procedureId: { type: "number" } },
      required: ["procedureId"],
    },
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
    name: "getProcedureStep",
    description: "Get information about a specific step",
    inputSchema: {
      type: "object",
      properties: {
        procedureId: { type: "number" },
        stepId: { type: "number" },
      },
      required: ["procedureId", "stepId"],
    },
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

// Mock the MCP SDK Server and capture handlers
const mockSetRequestHandler =
  vi.fn<
    (schema: { method: string }, handler: (args: any) => Promise<any>) => void
  >();
const mockHandlersMap = new Map<string, (args: any) => Promise<any>>();

vi.mock("@modelcontextprotocol/sdk/server/index.js", () => ({
  Server: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    close: vi.fn(),
    setRequestHandler: (
      schema: { method: any },
      handler: { (args: any): Promise<any>; (args: any): Promise<any> }
    ) => {
      mockSetRequestHandler(schema, handler);
      mockHandlersMap.set(schema.method, handler);
    },
    request: vi.fn(),
    notification: vi.fn(),
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

describe("MCP Server", () => {
  const mockBaseUrl = "http://mock-eregulations-api.test";

  beforeEach(() => {
    vi.clearAllMocks();
    mockHandlersMap.clear();
  });

  describe("createServer", () => {
    it("should create server with correct configuration", () => {
      const { server, handlers, cleanup } = createServer(mockBaseUrl);
      expect(server).toBeDefined();
      expect(handlers).toBeInstanceOf(Array);
      expect(cleanup).toBeInstanceOf(Function);
    });

    it("should pass baseUrl to the ERegulationsApi instance when provided", () => {
      createServer(mockBaseUrl);
      expect(mockApiMethods.setBaseUrl).toHaveBeenCalledWith(mockBaseUrl);
    });

    it("should not pass baseUrl to the ERegulationsApi when not provided", () => {
      createServer();
      expect(mockApiMethods.setBaseUrl).not.toHaveBeenCalled();
    });

    it("should call dispose on the API instance when cleanup is called", () => {
      const { cleanup } = createServer(mockBaseUrl);
      cleanup();
      expect(mockApiMethods.dispose).toHaveBeenCalled();
    });
  });

  describe("tools", () => {
    it("should define all required tools", () => {
      const { handlers } = createServer(mockBaseUrl);

      // Check that all required tools are defined
      const toolNames = [
        "listProcedures",
        "getProcedureDetails",
        "getProcedureStep",
      ];
      toolNames.forEach((toolName) => {
        const handler = handlers.find((h: ToolHandler) => h.name === toolName);
        expect(handler).toBeDefined();
        expect(handler?.description).toBeTruthy();
        expect(handler?.inputSchema).toBeDefined();
        expect(handler?.handler).toBeInstanceOf(Function);
      });
    });

    it("should define the listProcedures tool with correct schema", () => {
      const { handlers } = createServer(mockBaseUrl);
      const listProceduresHandler = handlers.find(
        (h: ToolHandler) => h.name === "listProcedures"
      );

      expect(listProceduresHandler).toBeDefined();
      expect(listProceduresHandler?.description).toContain(
        "List all available procedures"
      );
      expect(listProceduresHandler?.inputSchema).toHaveProperty(
        "type",
        "object"
      );
    });

    it("should define the getProcedureDetails tool with correct schema", () => {
      const { handlers } = createServer(mockBaseUrl);
      const getProcedureDetailsHandler = handlers.find(
        (h: ToolHandler) => h.name === "getProcedureDetails"
      );

      expect(getProcedureDetailsHandler).toBeDefined();
      expect(getProcedureDetailsHandler?.description).toContain(
        "Get detailed information"
      );
      expect(getProcedureDetailsHandler?.inputSchema).toHaveProperty(
        "type",
        "object"
      );
      expect(getProcedureDetailsHandler?.inputSchema.properties).toHaveProperty(
        "procedureId"
      );
      expect(getProcedureDetailsHandler?.inputSchema.required).toContain(
        "procedureId"
      );
    });

    it("should define the getProcedureStep tool with correct schema", () => {
      const { handlers } = createServer(mockBaseUrl);
      const getProcedureStepHandler = handlers.find(
        (h: ToolHandler) => h.name === "getProcedureStep"
      );

      expect(getProcedureStepHandler).toBeDefined();
      expect(getProcedureStepHandler?.description).toContain(
        "Get information about a specific step"
      );
      expect(getProcedureStepHandler?.inputSchema).toHaveProperty(
        "type",
        "object"
      );
      expect(getProcedureStepHandler?.inputSchema.properties).toHaveProperty(
        "procedureId"
      );
      expect(getProcedureStepHandler?.inputSchema.properties).toHaveProperty(
        "stepId"
      );
      expect(getProcedureStepHandler?.inputSchema.required).toContain(
        "procedureId"
      );
      expect(getProcedureStepHandler?.inputSchema.required).toContain("stepId");
    });
  });

  describe("handlers functionality", () => {
    it("should pass arguments to API methods correctly", async () => {
      const { handlers } = createServer(mockBaseUrl);

      // Test the listProcedures handler
      const listProceduresHandler = handlers.find(
        (h: ToolHandler) => h.name === "listProcedures"
      );
      await listProceduresHandler?.handler({});

      // Test the getProcedureDetails handler
      const getProcedureDetailsHandler = handlers.find(
        (h: ToolHandler) => h.name === "getProcedureDetails"
      );
      await getProcedureDetailsHandler?.handler({ procedureId: 123 });

      // Test the getProcedureStep handler
      const getProcedureStepHandler = handlers.find(
        (h: ToolHandler) => h.name === "getProcedureStep"
      );
      await getProcedureStepHandler?.handler({ procedureId: 123, stepId: 456 });
    });

    it("should handle validation errors for missing required parameters", async () => {
      const { handlers } = createServer(mockBaseUrl);

      // Test getProcedureDetails with missing procedureId
      const getProcedureDetailsHandler = handlers.find(
        (h: ToolHandler) => h.name === "getProcedureDetails"
      );
      await expect(async () => {
        try {
          await getProcedureDetailsHandler?.handler({});
        } catch (error) {
          throw error;
        }
      }).rejects.toThrow(/procedureId is required/i);

      // Test getProcedureStep with missing stepId
      const getProcedureStepHandler = handlers.find(
        (h: ToolHandler) => h.name === "getProcedureStep"
      );
      await expect(async () => {
        try {
          await getProcedureStepHandler?.handler({ procedureId: 123 });
        } catch (error) {
          throw error;
        }
      }).rejects.toThrow(/stepId is required/i);
    });
  });

  describe("MCP request handler registration", () => {
    it("should register all required MCP request handlers", () => {
      createServer(mockBaseUrl);

      // Verify that setRequestHandler was called 4 times (tools/list, tools/call, prompts/list, prompts/get)
      expect(mockSetRequestHandler).toHaveBeenCalledTimes(4);
    });

    it("should register tools/list handler", () => {
      createServer(mockBaseUrl);

      // Check if the handler was registered for ListToolsRequestSchema
      expect(mockSetRequestHandler).toHaveBeenCalledWith(
        ListToolsRequestSchema,
        expect.any(Function)
      );
    });

    it("should register tools/call handler", () => {
      createServer(mockBaseUrl);

      // Check if the handler was registered for CallToolRequestSchema
      expect(mockSetRequestHandler).toHaveBeenCalledWith(
        CallToolRequestSchema,
        expect.any(Function)
      );
    });

    it("should register prompts/list handler", () => {
      createServer(mockBaseUrl);

      // Check if the handler was registered for ListPromptsRequestSchema
      expect(mockSetRequestHandler).toHaveBeenCalledWith(
        ListPromptsRequestSchema,
        expect.any(Function)
      );
    });

    it("should register prompts/get handler", () => {
      createServer(mockBaseUrl);

      // Check if the handler was registered for GetPromptRequestSchema
      expect(mockSetRequestHandler).toHaveBeenCalledWith(
        GetPromptRequestSchema,
        expect.any(Function)
      );
    });
  });

  describe("MCP handler implementations", () => {
    beforeEach(() => {
      createServer(mockBaseUrl);
    });

    it("should return list of tools in ListToolsRequest handler", async () => {
      const listToolsHandler = mockHandlersMap.get("tools/list");
      if (!listToolsHandler) throw new Error("listToolsHandler is undefined");

      const response = await listToolsHandler({});
      expect(response).toHaveProperty("tools");
      expect(response.tools).toBeInstanceOf(Array);
      expect(response.tools).toHaveLength(3);

      expect(response.tools[0]).toMatchObject({
        name: "listProcedures",
        description: expect.any(String),
        inputSchema: expect.any(Object),
      });
    });

    it("should handle CallToolRequest for valid tools", async () => {
      const callToolHandler = mockHandlersMap.get("tools/call");
      if (!callToolHandler) throw new Error("callToolHandler is undefined");

      // Test calling a valid tool
      const response = await callToolHandler({
        params: {
          name: "listProcedures",
          arguments: {},
        },
      });

      expect(response).toHaveProperty("content");
      expect(response.content[0]).toMatchObject({
        type: "text",
        text: "list of procedures",
      });
    });

    it("should throw error for unknown tool in CallToolRequest", async () => {
      const callToolHandler = mockHandlersMap.get("tools/call");
      if (!callToolHandler) throw new Error("callToolHandler is undefined");

      await expect(
        callToolHandler({
          params: {
            name: "unknownTool",
            arguments: {},
          },
        })
      ).rejects.toThrow("Unknown tool: unknownTool");
    });

    it("should return list of prompts in ListPromptsRequest handler", async () => {
      const handler = mockHandlersMap.get("prompts/list");
      if (!handler) throw new Error("prompts/list handler is undefined");

      const response = await handler({} as any);
      expect(response).toHaveProperty("prompts");
      expect(response.prompts).toBeInstanceOf(Array);
      expect(response.prompts).toHaveLength(4);

      // Verify argument definitions for prompts
      const detailsPrompt = response.prompts.find(
        (p: { name: string; arguments?: any[] }) =>
          p.name === PromptName.GET_PROCEDURE_DETAILS
      );
      expect(detailsPrompt).toBeDefined();
      expect(detailsPrompt!.arguments![0]).toMatchObject({
        name: "procedureId",
        required: true,
      });

      const stepPrompt = response.prompts.find(
        (p: { name: string; arguments?: any[] }) =>
          p.name === PromptName.GET_PROCEDURE_STEP
      );
      expect(stepPrompt).toBeDefined();
      expect(stepPrompt!.arguments).toHaveLength(2);
    });

    it("should return prompt content in GetPromptRequest handler", async () => {
      const getPromptHandler = mockHandlersMap.get("prompts/get");
      if (!getPromptHandler) throw new Error("getPromptHandler is undefined");

      // Test each prompt type
      for (const promptName of Object.values(PromptName)) {
        const response = await getPromptHandler({
          params: { name: promptName },
        });

        expect(response).toHaveProperty("messages");
        expect(response.messages).toBeInstanceOf(Array);
        expect(response.messages[0]).toMatchObject({
          role: "user",
          content: {
            type: "text",
            text: PROMPT_TEMPLATES[promptName],
          },
        });
      }
    });

    it("should throw error for unknown prompt in GetPromptRequest", async () => {
      const getPromptHandler = mockHandlersMap.get("prompts/get");
      if (!getPromptHandler) throw new Error("getPromptHandler is undefined");

      await expect(
        getPromptHandler({
          params: { name: "unknownPrompt" },
        })
      ).rejects.toThrow("Unknown prompt: unknownPrompt");
    });
  });

  describe("prompts", () => {
    it("should define all required prompts", () => {
      createServer(mockBaseUrl);

      // Verify that the prompts are defined correctly
      expect(Object.values(PromptName)).toContain(PromptName.LIST_PROCEDURES);
      expect(Object.values(PromptName)).toContain(
        PromptName.GET_PROCEDURE_DETAILS
      );
      expect(Object.values(PromptName)).toContain(
        PromptName.GET_PROCEDURE_STEP
      );

      // Verify that prompt templates are defined for each prompt
      expect(PROMPT_TEMPLATES).toHaveProperty(PromptName.LIST_PROCEDURES);
      expect(PROMPT_TEMPLATES).toHaveProperty(PromptName.GET_PROCEDURE_DETAILS);
      expect(PROMPT_TEMPLATES).toHaveProperty(PromptName.GET_PROCEDURE_STEP);
    });
  });
});
