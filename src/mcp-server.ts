import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { ERegulationsApi } from "./services/eregulations-api.js";
import { logger } from "./utils/logger.js";
import { createHandlers } from "./mcp-capabilities/tools/handlers/index.js";
import { PromptName, PROMPT_TEMPLATES } from "./mcp-capabilities/prompts/templates.js";

export const createServer = (baseUrl: string) => {
  const api = new ERegulationsApi(baseUrl);
  
  logger.log(`Creating MCP server with API URL: ${baseUrl}`);
  
  const server = new Server(
    {
      name: "eregulations-mcp-server",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {
          listProcedures: true,
          getProcedureDetails: true,
          getProcedureStep: true,
          searchProcedures: true
        },
        prompts: {},
      },
    }
  );
  
  // Setup cleanup handlers
  const cleanup = () => {
    logger.log('Cleaning up server resources...');
    api.dispose();
  };

  // Create all tool handlers
  const handlers = createHandlers(api);

  // Register the tool list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    logger.log("Handling ListToolsRequest");
    
    const tools: Tool[] = handlers.map(handler => ({
      name: handler.name,
      description: handler.description,
      inputSchema: handler.inputSchema,
    }));
    
    return { tools };
  });

  // Register the tool call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    logger.log(`Handling tool call: ${name}`);
    
    const handler = handlers.find(h => h.name === name);
    if (!handler) {
      const errorMsg = `Unknown tool: ${name}`;
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    return handler.handler(args);
  });

  // Register standard prompts handlers
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    logger.log("Handling ListPromptsRequest");
    
    return {
      prompts: [
        {
          name: PromptName.LIST_PROCEDURES,
          description: "Get a list of all available procedures in the eRegulations system",
        },
        {
          name: PromptName.GET_PROCEDURE_DETAILS,
          description: "Get detailed information about a specific procedure by its ID",
          arguments: [
            {
              name: "procedureId",
              description: "ID of the procedure to retrieve",
              required: true,
            },
          ],
        },
        {
          name: PromptName.GET_PROCEDURE_STEP,
          description: "Get information about a specific step within a procedure",
          arguments: [
            {
              name: "procedureId",
              description: "ID of the procedure",
              required: true,
            },
            {
              name: "stepId", 
              description: "ID of the step within the procedure",
              required: true,
            },
          ],
        },
        {
          name: PromptName.SEARCH_PROCEDURES,
          description: "Search for procedures by text",
          arguments: [
            {
              name: "query",
              description: "Text search query",
              required: false,
            }
          ],
        }
      ],
    };
  });

  // Register handler for getting a specific prompt
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name } = request.params;
    logger.log(`Handling GetPromptRequest for prompt: ${name}`);
    
    // Return messages for the requested prompt
    if (Object.values(PromptName).includes(name as PromptName)) {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: PROMPT_TEMPLATES[name as PromptName],
            },
          },
        ],
      };
    }
    
    const errorMsg = `Unknown prompt: ${name}`;
    logger.error(errorMsg);
    throw new Error(errorMsg);
  });

  return { server, handlers, cleanup };
};