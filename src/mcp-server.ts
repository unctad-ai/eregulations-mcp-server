import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod"; // Import Zod
// Remove old schema imports
// import {
//   CallToolRequestSchema,
//   GetPromptRequestSchema,
//   ListPromptsRequestSchema,
//   ListToolsRequestSchema,
//   Tool,
// } from "@modelcontextprotocol/sdk/types.js";
import { ERegulationsApi } from "./services/eregulations-api.js";
import { logger } from "./utils/logger.js";
// Keep handler imports for now, but comment out createHandlers call temporarily
// import { createHandlers } from "./mcp-capabilities/tools/handlers/index.js";
// import {
//   PromptName,
//   PROMPT_TEMPLATES,
// } from "./mcp-capabilities/prompts/templates.js";
// Import the function to create handlers
import { createHandlers } from "./mcp-capabilities/tools/handlers/index.js";

/**
 * Create a new MCP server instance with eRegulations API integration
 * @param baseUrl Optional base URL for the eRegulations API. If not provided, will use EREGULATIONS_API_URL environment variable.
 * @returns An object containing the server instance
 */
export const createServer = (baseUrl?: string) => {
  // Create API instance with lazy-loading support
  const api = new ERegulationsApi();

  // Set the base URL if provided, otherwise it will be lazy-loaded from env vars when needed
  if (baseUrl) {
    logger.log(`Setting eRegulations API URL: ${baseUrl}`);
    api.setBaseUrl(baseUrl);
  }

  logger.log(`Creating eRegulations MCP server using McpServer`);

  // Instantiate McpServer (no capabilities needed)
  const server = new McpServer({
    name: "eregulations-mcp-server",
    version: "1.0.0", // Consider using version from package.json later
  });

  // Create handlers
  // const { createHandlers } = await import("./mcp-capabilities/tools/handlers/index.js"); // REMOVE await import
  const handlers = createHandlers(api);

  // Add the example 'add' tool for testing - REMOVED
  /*
  server.tool(
    "add",
    { a: z.number(), b: z.number() },
    async ({ a, b }) => {
      logger.info(`Handling tool call: add(${a}, ${b})`);
      return {
        // Ensure response matches MCP ToolResult structure
        content: [{ type: "text", text: String(a + b) }],
      };
    }
  );
  */

  // Register eRegulations tools
  handlers.forEach((handler) => {
    const schemaDef = handler.inputSchemaDefinition;
    // Check if it's an instance of ZodObject
    if (schemaDef instanceof z.ZodObject) {
      // Now TypeScript knows schemaDef is a ZodObject and has .shape
      // Cast handler to 'any' to bypass strict type checking
      server.tool(handler.name, schemaDef.shape, handler.handler as any);
      logger.info(`Registered tool '${handler.name}' with McpServer`);
    } else {
      // Handle non-object schemas or log warning
      logger.warn(
        `Could not register tool '${handler.name}': Schema is not a ZodObject.`
      );
    }
  });

  // Return only the server instance for now
  return { server };
  // Return server instance and an empty handlers array temporarily
  // return { server, handlers: [] };
};
