import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListToolsRequestSchema,
  Tool,
  ToolSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ERegulationsApi } from "./services/eregulations-api.js";
import { logger } from "./utils/logger.js";

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
  query: z.string().optional().describe("Text search query")
});

enum ToolName {
  LIST_PROCEDURES = "listProcedures",
  GET_PROCEDURE_DETAILS = "getProcedureDetails",
  GET_PROCEDURE_STEP = "getProcedureStep",
  SEARCH_PROCEDURES = "searchProcedures"
}

enum PromptName {
  LIST_PROCEDURES = "listProcedures",
  GET_PROCEDURE_DETAILS = "getProcedureDetails",
  GET_PROCEDURE_STEP = "getProcedureStep",
  SEARCH_PROCEDURES = "searchProcedures"
}

// Tool prompt templates with more consistent formatting based on MCP standard
const PROMPT_TEMPLATES = {
  [PromptName.LIST_PROCEDURES]: `# List Procedures
Get a list of all available procedures in the eRegulations system.

## Usage
\`\`\`json
{
  "name": "listProcedures"
}
\`\`\`

## Returns
A list of procedures with their IDs, names, and basic details.`,

  [PromptName.GET_PROCEDURE_DETAILS]: `# Get Procedure Details
Get detailed information about a specific procedure by its ID.

## Usage
\`\`\`json
{
  "name": "getProcedureDetails",
  "arguments": {
    "procedureId": 725  // Replace with the ID of the procedure you want to retrieve
  }
}
\`\`\`

## Notes
- Use listProcedures first to find valid procedure IDs
- Returns complete information about steps, requirements, timelines and costs`,

  [PromptName.GET_PROCEDURE_STEP]: `# Get Procedure Step
Get information about a specific step within a procedure.

## Usage
\`\`\`json
{
  "name": "getProcedureStep",
  "arguments": {
    "procedureId": 725,  // ID of the procedure
    "stepId": 2787      // ID of the step within that procedure
  }
}
\`\`\`

## Notes
- Use getProcedureDetails first to find valid step IDs within a procedure
- Returns detailed information about a specific step including requirements and contact information`,

  [PromptName.SEARCH_PROCEDURES]: `# Search Procedures
Search for procedures by text.

## Usage
\`\`\`json
{
  "name": "searchProcedures",
  "arguments": {
    "query": "import"  // Optional text to search for
  }
}
\`\`\`

## Notes
- Returns procedures whose names match the search query
- If no query is provided, returns all procedures`
};

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
    result += `Information Portal: ${procedure.data.url}\n\n`;
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
  
  let result = `Step: ${step.name || 'Unnamed'} (Step ID: ${step.id || 'Unknown'})\n`;
  if (step.procedureName) {
    result += `Part of procedure: ${step.procedureName} (ID: ${step.procedureId})\n`;
  }
  result += '\n';
  
  // Online completion information
  if (step.online?.url || step.isOnline) {
    result += "✓ Can be completed online\n";
    if (step.online?.url) {
      result += `Online portal: ${step.online.url}\n`;
    }
    result += '\n';
  }
  
  // Step metadata
  const metadata = [];
  if (step.isOptional) metadata.push("Optional step");
  if (step.isCertified) metadata.push("Requires certification");
  if (step.isParallel) metadata.push("Can be completed in parallel with other steps");
  if (metadata.length > 0) {
    result += "Status:\n";
    metadata.forEach(m => result += `⚬ ${m}\n`);
    result += '\n';
  }
  
  // Contact information
  if (step.contact) {
    result += "Contact Information:\n";
    if (step.contact.entityInCharge) {
      const entity = step.contact.entityInCharge;
      result += `▸ Entity: ${entity.name}\n`;
      if (entity.firstPhone || entity.secondPhone) {
        result += `  Phone: ${[entity.firstPhone, entity.secondPhone].filter(Boolean).join(', ')}\n`;
      }
      if (entity.firstEmail || entity.secondEmail) {
        result += `  Email: ${[entity.firstEmail, entity.secondEmail].filter(Boolean).join(', ')}\n`;
      }
      if (entity.firstWebsite || entity.secondWebsite) {
        result += `  Website: ${[entity.firstWebsite, entity.secondWebsite].filter(Boolean).join(', ')}\n`;
      }
      if (entity.address) {
        result += `  Address: ${entity.address}\n`;
      }
      if (entity.scheduleComments) {
        result += `  Hours: ${entity.scheduleComments}\n`;
      }
    }
    if (step.contact.unitInCharge?.name) {
      result += `▸ Unit: ${step.contact.unitInCharge.name}\n`;
    }
    if (step.contact.personInCharge?.name) {
      result += `▸ Contact Person: ${step.contact.personInCharge.name}\n`;
      if (step.contact.personInCharge.profession) {
        result += `  Role: ${step.contact.personInCharge.profession}\n`;
      }
    }
    result += '\n';
  }
  
  // Requirements
  if (step.requirements?.length) {
    result += "Required Documents:\n";
    step.requirements.forEach((req: any, index: number) => {
      result += `${index + 1}. ${req.name}\n`;
      if (req.comments) {
        result += `   Note: ${req.comments}\n`;
      }
      if (req.nbOriginal || req.nbCopy || req.nbAuthenticated) {
        const copies = [];
        if (req.nbOriginal) copies.push(`${req.nbOriginal} original(s)`);
        if (req.nbCopy) copies.push(`${req.nbCopy} copy/copies`);
        if (req.nbAuthenticated) copies.push(`${req.nbAuthenticated} authenticated copy/copies`);
        result += `   Required: ${copies.join(', ')}\n`;
      }
    });
    result += '\n';
  }
  
  // Results/outputs of this step
  if (step.results?.length) {
    result += "Outputs:\n";
    step.results.forEach((res: any, index: number) => {
      result += `${index + 1}. ${res.name}`;
      if (res.isFinalResult) result += " (Final document)";
      result += '\n';
      if (res.comments) {
        result += `   Note: ${res.comments}\n`;
      }
    });
    result += '\n';
  }
  
  // Timeframes
  if (step.timeframe) {
    result += "Time Estimates:\n";
    const tf = step.timeframe;
    if (tf.timeSpentAtTheCounter?.minutes?.max) {
      result += `▸ Time at counter: up to ${tf.timeSpentAtTheCounter.minutes.max} minutes\n`;
    }
    if (tf.waitingTimeInLine?.minutes?.max) {
      result += `▸ Waiting time: up to ${tf.waitingTimeInLine.minutes.max} minutes\n`;
    }
    if (tf.waitingTimeUntilNextStep?.days?.max) {
      result += `▸ Processing time: up to ${tf.waitingTimeUntilNextStep.days.max} days\n`;
    }
    if (tf.comments) {
      result += `▸ Note: ${tf.comments}\n`;
    }
    result += '\n';
  }
  
  // Costs
  if (step.costs?.length) {
    result += "Costs:\n";
    step.costs.forEach((cost: any) => {
      if (cost.value) {
        if (cost.operator === 'percentage') {
          result += `▸ ${cost.comments}: ${cost.value}% ${cost.parameter || ''}\n`;
        } else {
          result += `▸ ${cost.comments}: ${cost.value} ${cost.unit}\n`;
        }
        if (cost.paymentDetails) {
          result += `  Payment details: ${cost.paymentDetails}\n`;
        }
      }
    });
    result += '\n';
  }
  
  // Laws and regulations
  if (step.laws?.length) {
    result += "Legal References:\n";
    step.laws.forEach((law: any) => {
      result += `▸ ${law.name}\n`;
    });
    result += '\n';
  }
  
  // Additional information
  if (step.additionalInfo?.text) {
    result += `Additional Information:\n${step.additionalInfo.text}\n`;
  }
  
  return result;
}

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

  // Define all tools
  const handlers = [
    {
      name: ToolName.LIST_PROCEDURES,
      description: "List all available procedures in the eRegulations system",
      inputSchema: zodToJsonSchema(ListProceduresSchema) as ToolInput,
      handler: async () => {
        try {
          logger.log(`Handling LIST_PROCEDURES request`);
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
          
          logger.log(`LIST_PROCEDURES returning ${proceduresArray.length} procedures`);
          
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
          logger.error(`Error in LIST_PROCEDURES handler:`, error);
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
          logger.log(`Handling GET_PROCEDURE_DETAILS request for procedure ID ${procedureId}`);
          
          // Get the basic procedure details first
          const procedure = await api.getProcedureById(procedureId);
          
          // Try to get additional information in parallel
          const [resume, totals] = await Promise.all([
            api.getProcedureResume(procedureId).catch(err => {
              logger.error(`Error fetching procedure resume for ID ${procedureId}:`, err);
              return null;
            }),
            api.getProcedureTotals(procedureId).catch(err => {
              logger.error(`Error fetching procedure totals for ID ${procedureId}:`, err);
              return null;
            })
          ]);
          // Format procedure data for LLM consumption
          let formattedProcedure = formatProcedureForLLM({
            ...procedure,
            resume,
            totals
          });
          
          logger.log(`Successfully retrieved details for procedure ID ${procedureId}`);
          
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
          logger.error(`Error in GET_PROCEDURE_DETAILS handler for ID ${args?.procedureId}:`, errorMessage);
          
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
      description: "Search for procedures using text search",
      inputSchema: zodToJsonSchema(SearchProceduresSchema) as ToolInput,
      handler: async (args: any) => {
        try {
          const { query } = args;
          const apiResults = await api.searchByName(query || '');

          // Format results for display
          let searchResults = `Found ${apiResults.length} procedures`;
          if (query) searchResults += ` matching "${query}"`;
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
    }
  ];

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