import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  CompleteRequestSchema,
  ListToolsRequestSchema,
  Tool,
  ToolSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ERegulationsApi } from "./services/eregulations-api.js";

const ToolInputSchema = ToolSchema.shape.inputSchema;
type ToolInput = z.infer<typeof ToolInputSchema>;

/* Input schemas for tools implemented in this server */
const ListProceduresSchema = z.object({});

const GetProcedureDetailsSchema = z.object({
  procedureId: z.number().describe("ID of the procedure to retrieve")
});

const GetProcedureStepSchema = z.object({
  procedureId: z.number().describe("ID of the procedure"),
  stepId: z.number().describe("ID of the step within the procedure")
});

const SearchProceduresSchema = z.object({
  query: z.string().describe("Search query for procedures"),
  filters: z.array(z.any()).optional().describe("Optional filters to apply")
});

enum ToolName {
  LIST_PROCEDURES = "listProcedures",
  GET_PROCEDURE_DETAILS = "getProcedureDetails",
  GET_PROCEDURE_STEP = "getProcedureStep",
  SEARCH_PROCEDURES = "searchProcedures",
}

export const createServer = (baseUrl: string) => {
  const api = new ERegulationsApi(baseUrl);
  
  const server = new Server(
    {
      name: "eregulations-mcp-server",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );
  
  // Define all tools
  const handlers = [
    {
      name: ToolName.LIST_PROCEDURES,
      description: "List all available procedures in the eRegulations system",
      inputSchema: zodToJsonSchema(ListProceduresSchema) as ToolInput,
      handler: async () => {
        try {
          const procedures = await api.getProceduresList();
          return {
            content: [
              {
                type: "text",
                text: `Found ${procedures.length} procedures.`,
              },
              {
                type: "json",
                json: procedures,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error retrieving procedures: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
          };
        }
      }
    },
    {
      name: ToolName.GET_PROCEDURE_DETAILS,
      description: "Get detailed information about a specific procedure by ID",
      inputSchema: zodToJsonSchema(GetProcedureDetailsSchema) as ToolInput,
      handler: async (args: any) => {
        try {
          const { procedureId } = args;
          const procedure = await api.getProcedureById(procedureId);
          const resume = await api.getProcedureResume(procedureId);
          
          return {
            content: [
              {
                type: "text",
                text: `Procedure: ${procedure.name}`,
              },
              {
                type: "json",
                json: {
                  procedure,
                  summary: resume
                },
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error retrieving procedure details: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
          };
        }
      }
    },
    {
      name: ToolName.GET_PROCEDURE_STEP,
      description: "Get information about a specific step within a procedure",
      inputSchema: zodToJsonSchema(GetProcedureStepSchema) as ToolInput,
      handler: async (args: any) => {
        try {
          const { procedureId, stepId } = args;
          const step = await api.getProcedureStep(procedureId, stepId);
          
          return {
            content: [
              {
                type: "text",
                text: `Step: ${step.name}`,
              },
              {
                type: "json",
                json: step,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error retrieving step details: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
          };
        }
      }
    },
    {
      name: ToolName.SEARCH_PROCEDURES,
      description: "Search for procedures by name or apply filters",
      inputSchema: zodToJsonSchema(SearchProceduresSchema) as ToolInput,
      handler: async (args: any) => {
        try {
          const { query, filters } = args;
          
          // If filters are provided, use them
          if (filters && filters.length > 0) {
            const results = await api.searchByFilters(filters);
            return {
              content: [
                {
                  type: "text",
                  text: `Search results for filters:`,
                },
                {
                  type: "json",
                  json: results,
                },
              ],
            };
          }
          
          // Otherwise, fetch all procedures and filter by name
          const procedures = await api.getProceduresList();
          const filteredProcedures = procedures.filter((proc: any) => 
            proc.name.toLowerCase().includes(query.toLowerCase())
          );
          
          return {
            content: [
              {
                type: "text",
                text: `Found ${filteredProcedures.length} procedures matching "${query}".`,
              },
              {
                type: "json",
                json: filteredProcedures,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error searching procedures: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
          };
        }
      }
    },
  ];

  // Register the tool list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
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
    
    const handler = handlers.find(h => h.name === name);
    if (!handler) {
      throw new Error(`Unknown tool: ${name}`);
    }
    
    return handler.handler(args);
  });

  return { server, handlers };
};