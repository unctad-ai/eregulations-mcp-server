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
  
  let result = '';
  
  // Get name from full procedure data structure
  const name = procedure.fullName || procedure.name || (procedure.data && procedure.data.name);
  result += `Procedure: ${name} (ID: ${procedure.id || 'Unknown'})\n\n`;
  
  if (procedure.data?.url) {
    result += `Online Portal: ${procedure.data.url}\n\n`;
  }

  if (procedure.data?.additionalInfo) {
    result += `Description: ${procedure.data.additionalInfo}\n\n`;
  }
  
  // Handle blocks section which contains the steps
  if (procedure.data?.blocks && procedure.data.blocks.length) {
    result += 'Steps:\n';
    procedure.data.blocks.forEach((block: any) => {
      if (block.steps && block.steps.length) {
        block.steps.forEach((step: any, index: number) => {
          result += `${index + 1}. ${step.name}\n`;
          
          if (step.isOnline) {
            result += `   - Can be completed online\n`;
          }
          
          if (step.contact?.entityInCharge) {
            result += `   - Entity: ${step.contact.entityInCharge.name}\n`;
            if (step.contact.entityInCharge.firstPhone) {
              result += `   - Phone: ${step.contact.entityInCharge.firstPhone}\n`;
            }
            if (step.contact.entityInCharge.firstEmail) {
              result += `   - Email: ${step.contact.entityInCharge.firstEmail}\n`;
            }
          }
          
          if (step.requirements && step.requirements.length) {
            result += '   Requirements:\n';
            step.requirements.forEach((req: any) => {
              result += `   - ${req.name}\n`;
              if (req.comments) {
                result += `     Note: ${req.comments}\n`;
              }
            });
          }
          
          if (step.timeframe) {
            const tf = step.timeframe;
            if (tf.timeSpentAtTheCounter?.minutes?.max) {
              result += `   - Time at counter: up to ${tf.timeSpentAtTheCounter.minutes.max} minutes\n`;
            }
            if (tf.waitingTimeInLine?.minutes?.max) {
              result += `   - Waiting time: up to ${tf.waitingTimeInLine.minutes.max} minutes\n`;
            }
            if (tf.waitingTimeUntilNextStep?.days?.max) {
              result += `   - Processing time: up to ${tf.waitingTimeUntilNextStep.days.max} days\n`;
            }
          }
          
          if (step.additionalInfo?.text) {
            result += `   Note: ${step.additionalInfo.text}\n`;
          }
          
          result += '\n';
        });
      }
    });
  }
  
  // Handle results section (final documents)
  if (procedure.data?.blocks) {
    const finalResults = procedure.data.blocks
      .flatMap((block: any) => block.steps || [])
      .flatMap((step: any) => step.results || [])
      .filter((result: any) => result.isFinalResult);
    
    if (finalResults.length) {
      result += '\nFinal Documents:\n';
      finalResults.forEach((doc: any) => {
        result += `- ${doc.name}\n`;
      });
    }
  }
  
  // Add resume info if available
  if (procedure.resume) {
    result += '\nSummary:\n';
    result += `Total steps: ${procedure.resume.totalSteps || procedure.data?.blocks?.reduce((acc: number, block: any) => acc + (block.steps?.length || 0), 0) || 'Unknown'}\n`;
    result += `Total institutions: ${procedure.resume.totalInstitutions || 'Unknown'}\n`;
    result += `Total requirements: ${procedure.resume.totalRequirements || 'Unknown'}\n`;
  }
  
  // Add totals info if available
  if (procedure.totals) {
    result += '\nTotals:\n';
    if (procedure.totals.time) {
      result += `Time: ${procedure.totals.time}\n`;
    }
    if (procedure.totals.cost) {
      result += `Cost: ${procedure.totals.cost}\n`;
    }
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
        tools: {
          listProcedures: true,
          getProcedureDetails: true,
          getProcedureStep: true,
          searchProcedures: true
        },
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
            proceduresArray.forEach((proc: any, index: number) => {
              const id = proc.id || 'N/A';
              const name = proc.fullName || proc.name || 'Unknown';
              const description = proc.explanatoryText ? `\n   Description: ${proc.explanatoryText}` : '';
              const online = proc.isOnline ? ' (Online)' : '';
              
              proceduresSummary += `${index + 1}. ${name}${online} (ID: ${id})${description}\n`;
            });
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
          
          // Get the basic procedure details first
          const procedure = await api.getProcedureById(procedureId);
          
          // Try to get additional information in parallel
          const [resume, totals] = await Promise.all([
            api.getProcedureResume(procedureId).catch(err => null),
            api.getProcedureTotals(procedureId).catch(err => null)
          ]);

          // Format procedure data for LLM consumption
          let formattedProcedure = formatProcedureForLLM({
            ...procedure,
            resume,
            totals
          });

          return {
            content: [
              { 
                type: "text", 
                text: formattedProcedure
              },
              {
                type: "text",
                text: "```json\n" + JSON.stringify({procedure, resume, totals}, null, 2) + "\n```",
                annotations: {
                  role: "data"
                }
              }
            ],
          };
        } catch (error: any) {
          const errorMessage = error.message || String(error);
          return {
            content: [
              {
                type: "text",
                text: `Error retrieving procedure details: ${errorMessage}\n\nValid procedure IDs can be found by using the listProcedures tool first.`,
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