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

/**
 * Format procedure data in a way that's more suitable for LLMs to process
 */
function formatProcedureForLLM(procedure: any): string {
  if (!procedure) return "No procedure data available";
  
  let result = `Procedure: ${procedure.name || 'Unnamed'} (ID: ${procedure.id || 'Unknown'})\n`;
  
  if (procedure.additionalInfo) {
    result += `\nDescription: ${procedure.additionalInfo}\n`;
  }
  
  if (procedure.blocks && procedure.blocks.length) {
    result += "\nBlocks:\n";
    procedure.blocks.forEach((block: any, index: number) => {
      result += `${index + 1}. ${block.name || 'Unnamed block'}\n`;
      
      if (block.steps && block.steps.length) {
        block.steps.forEach((step: any, stepIndex: number) => {
          result += `   ${index + 1}.${stepIndex + 1}. ${step.name || 'Unnamed step'} (Step ID: ${step.id || 'Unknown'})\n`;
          if (step.isOnline) {
            result += `      - Available online\n`;
          }
        });
      }
    });
  }
  
  return result;
}

/**
 * Format step data in a way that's more suitable for LLMs to process
 */
function formatStepForLLM(step: any): string {
  if (!step) return "No step data available";
  
  let result = `Step: ${step.name || 'Unnamed'} (ID: ${step.id || 'Unknown'})\n`;
  
  if (step.isOnline) {
    result += "This step can be completed online.\n";
  }
  
  if (step.isOptional) {
    result += "This step is optional.\n";
  }
  
  if (step.isCertified) {
    result += "This step is certified.\n";
  }
  
  if (step.contact) {
    result += "\nContact Information:\n";
    if (step.contact.entityInCharge) {
      result += `Entity: ${step.contact.entityInCharge.name}\n`;
    }
    if (step.contact.unitInCharge) {
      result += `Unit: ${step.contact.unitInCharge.name}\n`;
    }
    if (step.contact.personInCharge) {
      result += `Person: ${step.contact.personInCharge.name}\n`;
    }
  }
  
  if (step.requirements && step.requirements.length) {
    result += "\nRequirements:\n";
    step.requirements.forEach((req: any, index: number) => {
      result += `${index + 1}. ${req.name}\n`;
    });
  }
  
  return result;
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
          
          // Ensure procedures is an array
          const proceduresArray = Array.isArray(procedures) ? procedures : [];
          
          // Format a summary of procedures for the text response
          let proceduresSummary = `Found ${proceduresArray.length} procedures:\n\n`;
          
          if (proceduresArray.length > 0) {
            proceduresArray.slice(0, 10).forEach((proc: any, index: number) => {
              proceduresSummary += `${index + 1}. ${proc.name || 'Unknown'} (ID: ${proc.id || 'N/A'})\n`;
            });
            
            if (proceduresArray.length > 10) {
              proceduresSummary += `\n... and ${proceduresArray.length - 10} more procedures.`;
            }
          } else {
            proceduresSummary += "No procedures found.";
          }
          
          // Return both human-readable text and structured data
          return {
            content: [
              { 
                type: "text", 
                text: proceduresSummary
              },
              {
                type: "text",
                text: "```json\n" + JSON.stringify(proceduresArray, null, 2) + "\n```",
                annotations: {
                  role: "data"
                }
              }
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
          
          // Format procedure data for LLM consumption
          const formattedProcedure = formatProcedureForLLM(procedure);
          
          // Prepare summary data from resume
          let resumeText = "";
          if (resume) {
            resumeText = `\nSummary:\n- Total steps: ${resume.steps || 'Unknown'}\n` +
                        `- Institutions involved: ${resume.institutionCount || 'Unknown'}\n` +
                        `- Requirements: ${resume.requirementCount || 'Unknown'}\n`;
          }
          
          return {
            content: [
              { 
                type: "text", 
                text: formattedProcedure + resumeText
              },
              {
                type: "text",
                text: "```json\n" + JSON.stringify({procedure, summary: resume}, null, 2) + "\n```",
                annotations: {
                  role: "data"
                }
              }
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
          
          // Format step data for LLM consumption
          const formattedStep = formatStepForLLM(step);
          
          return {
            content: [
              { 
                type: "text", 
                text: formattedStep
              },
              {
                type: "text",
                text: "```json\n" + JSON.stringify(step, null, 2) + "\n```",
                annotations: {
                  role: "data"
                }
              }
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
          let apiResults;
          
          // If filters are provided, use them
          if (filters && filters.length > 0) {
            apiResults = await api.searchByFilters(filters);
          } else {
            // Use our searchByName method instead of manually filtering
            apiResults = await api.searchByName(query);
          }
          
          // Ensure results is an array
          const results = Array.isArray(apiResults) ? apiResults : [];
          
          // Format results for LLM consumption
          let searchResults = `Found ${results.length} procedures matching "${query}":\n\n`;
          
          if (results.length > 0) {
            results.slice(0, 10).forEach((proc: any, index: number) => {
              searchResults += `${index + 1}. ${proc.name || 'Unknown'} (ID: ${proc.id || 'N/A'})\n`;
            });
            
            if (results.length > 10) {
              searchResults += `\n... and ${results.length - 10} more results.`;
            }
          } else {
            searchResults += "No matching procedures found.";
          }
          
          return {
            content: [
              { 
                type: "text", 
                text: searchResults
              },
              {
                type: "text",
                text: "```json\n" + JSON.stringify(results, null, 2) + "\n```",
                annotations: {
                  role: "data"
                }
              }
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