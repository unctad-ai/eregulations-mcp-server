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
  query: z.string().optional().describe("Optional text search query"),
  filters: z.array(z.object({
    filterId: z.number().describe("ID of the filter category (from /Filters endpoint)"),
    filterOptionId: z.number().describe("ID of the selected option (from /Filters/{id}/Options endpoint)")
  })).optional().describe("API-compatible filter criteria")
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
  let stepNumber = 1;
  
  // Get name and ID from full procedure data structure
  const name = procedure.fullName || procedure.name || (procedure.data && procedure.data.name) || 'Unknown';
  const id = procedure.data?.id || procedure.id || 'Unknown';
  result += `Procedure: ${name} (ID: ${id})\n\n`;
  
  if (procedure.data?.url) {
    result += `Online Portal: ${procedure.data.url}\n\n`;
  }

  // For tracking totals
  const institutions = new Set<string>();
  const requirements = new Set<string>();
  let totalTimeAtCounter = 0;
  let totalWaitingTime = 0;
  let totalProcessingDays = 0;
  let totalCost = 0;
  let percentageCosts: {name: string, value: number, unit: string}[] = [];
  
  // Handle blocks section which contains the steps
  if (procedure.data?.blocks && procedure.data.blocks.length) {
    result += 'Steps:\n';

    procedure.data.blocks.forEach((block: any) => {
      if (block.steps && block.steps.length) {
        block.steps.forEach((step: any) => {
          result += `${stepNumber++}. ${step.name} (Step ID: ${step.id})\n`;
          
          // Check if step can be completed online
          if (step.online?.url || step.isOnline) {
            const onlineUrl = step.online?.url || 
                            (step.name.toLowerCase().includes('tra') ? 'https://www.tra.go.tz/' :
                             step.name.toLowerCase().includes('tbs') ? 'https://oas.tbs.go.tz/register' :
                             step.name.toLowerCase().includes('payment') ? 'http://tanzania.tradeportal.org/menu/284' : '');
            if (onlineUrl) {
              result += `   - Can be completed online: ${onlineUrl}\n`;
            }
          }

          // Add entity information if available
          if (step.contact?.entityInCharge) {
            const entity = step.contact.entityInCharge;
            result += `   - Entity: ${entity.name} \n`;
            institutions.add(entity.name);
            
            if (entity.firstPhone) {
              result += `   - Phone: ${entity.firstPhone} \n`;
            }
            if (entity.firstEmail) {
              result += `   - Email: ${entity.firstEmail}\n`;
            }
          }

          // Add requirements if any
          if (step.requirements && step.requirements.length > 0) {
            result += '   Requirements:\n';
            step.requirements.forEach((req: any) => {
              // Only add unique requirements
              if (!requirements.has(req.name)) {
                requirements.add(req.name);
                result += `   - ${req.name}\n`;
                if (req.comments) {
                  result += `     Note: ${req.comments}\n`;
                }
              }
            });
          }

          // Add timeframes if available
          if (step.timeframe) {
            const tf = step.timeframe;
            if (tf.timeSpentAtTheCounter?.minutes?.max) {
              const minutes = tf.timeSpentAtTheCounter.minutes.max;
              result += `   - Time at counter: up to ${minutes} minutes\n`;
              totalTimeAtCounter += minutes;
            }
            if (tf.waitingTimeInLine?.minutes?.max) {
              const minutes = tf.waitingTimeInLine.minutes.max;
              result += `   - Waiting time: up to ${minutes} minutes\n`;
              totalWaitingTime += minutes;
            }
            if (tf.waitingTimeUntilNextStep?.days?.max) {
              const days = tf.waitingTimeUntilNextStep.days.max;
              result += `   - Processing time: up to ${days} days\n`;
              totalProcessingDays += days;
            }
          }

          // Add costs if any
          if (step.costs && step.costs.length > 0) {
            result += '   Costs:\n';
            step.costs.forEach((cost: any) => {
              if (cost.value) {
                if (cost.operator === 'percentage') {
                  result += `   - ${cost.comments}: ${cost.value}% ${cost.parameter}\n`;
                  percentageCosts.push({
                    name: cost.comments,
                    value: cost.value,
                    unit: cost.unit
                  });
                } else {
                  result += `   - ${cost.comments}: ${cost.value} ${cost.unit}\n`;
                  if (cost.unit === 'TZS') {
                    totalCost += parseFloat(cost.value);
                  }
                }
              }
            });
          }

          if (step.additionalInfo?.text) {
            result += `   Note: ${step.additionalInfo.text}\n`;
          }

          result += '\n';
        });
      }
    });
  }

  // Add final documents section if available
  const finalResults = procedure.data?.blocks?.[0]?.steps?.flatMap((step: any) => 
    step.results?.filter((result: any) => result.isFinalResult) || []
  ) || [];

  if (finalResults.length > 0) {
    result += '\nFinal Documents:\n';
    finalResults.forEach((doc: any) => {
      result += `- ${doc.name}\n`;
    });
    result += '\n';
  }

  // Add summary section with totals
  result += 'Summary:\n';
  result += `Total steps: ${stepNumber - 1}\n`;
  result += `Total institutions: ${institutions.size}\n`;
  result += `Total requirements: ${requirements.size}\n\n`;

  // Calculate overall totals
  result += 'Totals:\n';
  const totalTime = (totalProcessingDays + 
    (totalTimeAtCounter + totalWaitingTime) / (60 * 24));  // Convert minutes to days
  
  if (totalTime > 0) {
    result += `Time: ${totalTime.toFixed(2)} days\n`;
  }
  
  if (totalCost > 0) {
    result += `Fixed costs: ${totalCost.toLocaleString()} TZS\n`;
  }

  if (percentageCosts.length > 0) {
    result += 'Variable costs:\n';
    percentageCosts.forEach(cost => {
      result += `- ${cost.name}: ${cost.value}% (${cost.unit})\n`;
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
      description: "Search for procedures using text search and/or filters. Use getFilters() first to get available filter categories, then getFilterOptions(filterId) to get valid options for each filter.",
      inputSchema: zodToJsonSchema(SearchProceduresSchema) as ToolInput,
      handler: async (args: any) => {
        try {
          const { query, filters } = args;
          let apiResults;
          
          // If both query and filters provided, combine results
          if (query && filters?.length > 0) {
            const [nameResults, filterResults] = await Promise.all([
              api.searchByName(query),
              api.searchByFilters(filters)
            ]);
            
            // Find procedures that match both name and filters
            apiResults = nameResults.filter(proc => 
              filterResults.some((f: { id: number }) => f.id === proc.id)
            );
          }
          // Only filters provided
          else if (filters?.length > 0) {
            apiResults = await api.searchByFilters(filters);
          }
          // Only name search or no criteria
          else {
            apiResults = await api.searchByName(query || '');
          }

          // Format results for display
          let searchResults = `Found ${apiResults.length} procedures`;
          if (query) searchResults += ` matching "${query}"`;
          if (filters?.length) searchResults += ` with ${filters.length} active filters`;
          searchResults += ':\n\n';
          
          if (apiResults.length > 0) {
            apiResults.slice(0, 10).forEach((proc: any, index: number) => {
              searchResults += `${index + 1}. ${proc.name || 'Unknown'} (ID: ${proc.id || 'N/A'})\n`;
            });
            
            if (apiResults.length > 10) {
              searchResults += `\n... and ${apiResults.length - 10} more results.`;
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
                text: "```json\n" + JSON.stringify(apiResults, null, 2) + "\n```",
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