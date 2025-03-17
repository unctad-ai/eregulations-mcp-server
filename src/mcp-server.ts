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
 * Format procedure data in a way that's optimized for LLMs with context length constraints
 * Focuses on essential information and uses a compact representation
 */
function formatProcedureForLLM(procedure: any): string {
  if (!procedure) return "No procedure data available";
  
  // Sets for tracking unique entities to avoid repetition
  const institutions = new Set<string>();
  const requirements = new Set<string>();
  let totalTimeAtCounter = 0;
  let totalWaitingTime = 0;
  let totalProcessingDays = 0;
  let totalCost = 0;
  let percentageCosts: {name: string, value: number, unit: string}[] = [];
  
  // Get name and ID from full procedure data structure
  const name = procedure.fullName || procedure.name || (procedure.data && procedure.data.name) || 'Unknown';
  const id = procedure.data?.id || procedure.id || 'Unknown';
  
  // Start with compact header
  let result = `PROCEDURE: ${name} (ID:${id})\n`;
  
  // Add URL only if available (save context space)
  if (procedure.data?.url) {
    result += `URL: ${procedure.data.url}\n`;
  }
  
  // Add explanatory text if available, with length limit
  if (procedure.explanatoryText) {
    // Truncate long descriptions to save context space
    const maxLength = 200;
    const description = procedure.explanatoryText.length > maxLength ? 
      procedure.explanatoryText.substring(0, maxLength) + "..." : 
      procedure.explanatoryText;
    result += `DESC: ${description}\n`;
  }
  
  result += "\nSTEPS:\n";
  let stepNumber = 1;
  
  // Handle blocks section which contains the steps
  if (procedure.data?.blocks && procedure.data.blocks.length) {
    procedure.data.blocks.forEach((block: any) => {
      if (block.steps && block.steps.length) {
        block.steps.forEach((step: any) => {
          // Compact step header
          result += `${stepNumber}. ${step.name} (ID:${step.id})`;
          
          // Add online indicator with minimal text
          if (step.online?.url || step.isOnline) {
            result += " [ONLINE]";
            // Only add URL if it's specifically provided
            if (step.online?.url) {
              result += ` ${step.online.url}`;
            }
          }
          result += "\n";
          
          // Add entity information in compact format
          if (step.contact?.entityInCharge) {
            const entity = step.contact.entityInCharge;
            institutions.add(entity.name);
            result += `   Entity: ${entity.name}\n`;
          }
          
          // Add requirements with minimal formatting
          if (step.requirements && step.requirements.length > 0) {
            result += '   Req:';
            // Use inline format for requirements to save space
            step.requirements.forEach((req: any) => {
              if (!requirements.has(req.name)) {
                requirements.add(req.name);
                result += ` ${req.name};`;
              }
            });
            result += '\n';
          }
          
          // Add timeframes in compact format
          if (step.timeframe) {
            const tf = step.timeframe;
            if (tf.waitingTimeUntilNextStep?.days?.max) {
              const days = tf.waitingTimeUntilNextStep.days.max;
              result += `   Time: ~${days} days\n`;
              totalProcessingDays += days;
            }
            
            // Accumulate counter time without adding to output
            if (tf.timeSpentAtTheCounter?.minutes?.max) {
              totalTimeAtCounter += tf.timeSpentAtTheCounter.minutes.max;
            }
            if (tf.waitingTimeInLine?.minutes?.max) {
              totalWaitingTime += tf.waitingTimeInLine.minutes.max;
            }
          }
          
          // Add costs in compact format
          if (step.costs && step.costs.length > 0) {
            result += '   Cost:';
            step.costs.forEach((cost: any) => {
              if (cost.value) {
                if (cost.operator === 'percentage') {
                  result += ` ${cost.value}% ${cost.parameter || ''};`;
                  percentageCosts.push({
                    name: cost.comments || 'Fee',
                    value: cost.value,
                    unit: cost.unit || ''
                  });
                } else {
                  result += ` ${cost.value} ${cost.unit};`;
                  if (cost.unit === 'TZS') {
                    totalCost += parseFloat(cost.value);
                  }
                }
              }
            });
            result += '\n';
          }
          
          stepNumber++;
        });
      }
    });
  }
  
  // Add final documents section if available - compact format
  const finalResults = procedure.data?.blocks?.[0]?.steps?.flatMap((step: any) => 
    step.results?.filter((result: any) => result.isFinalResult) || []
  ) || [];
  
  if (finalResults.length > 0) {
    result += '\nFINAL DOCUMENTS:';
    finalResults.forEach((doc: any) => {
      result += ` ${doc.name};`;
    });
    result += '\n';
  }
  
  // Add summary section with totals in compact format
  result += '\nSUMMARY:\n';
  result += `Steps: ${stepNumber - 1} | Institutions: ${institutions.size} | Requirements: ${requirements.size}\n`;
  
  // Calculate overall totals
  const totalMinutes = totalTimeAtCounter + totalWaitingTime;
  const totalTime = totalProcessingDays + (totalMinutes / (60 * 24));  // Convert minutes to days
  
  if (totalTime > 0) {
    // Round to 1 decimal place for cleaner output
    result += `Est. time: ${totalTime.toFixed(1)} days`;
    if (totalMinutes > 0) {
      result += ` (includes ${totalMinutes} minutes at counters)`;
    }
    result += '\n';
  }
  
  if (totalCost > 0) {
    // Use compact number formatting
    result += `Fixed costs: ${totalCost.toLocaleString()} TZS\n`;
  }
  
  if (percentageCosts.length > 0) {
    result += 'Variable costs:';
    percentageCosts.forEach(cost => {
      result += ` ${cost.name}: ${cost.value}%${cost.unit ? ' ' + cost.unit : ''};`;
    });
    result += '\n';
  }
  
  return result;
}

/**
 * Format step data in a way that's optimized for LLMs with context length constraints
 */
function formatStepForLLM(step: any): string {
  if (!step) return "No step data available";
  
  // Start with compact header
  let result = `STEP: ${step.name || 'Unnamed'} (ID:${step.id || 'Unknown'})\n`;
  if (step.procedureName) {
    result += `PROCEDURE: ${step.procedureName} (ID:${step.procedureId})\n`;
  }
  
  // Online completion indicator
  if (step.online?.url || step.isOnline) {
    result += "ONLINE: Yes";
    if (step.online?.url) {
      result += ` (${step.online.url})`;
    }
    result += '\n';
  }
  
  // Step metadata in compact format
  const metadata = [];
  if (step.isOptional) metadata.push("Optional");
  if (step.isCertified) metadata.push("Certified");
  if (step.isParallel) metadata.push("Parallel");
  if (metadata.length > 0) {
    result += `STATUS: ${metadata.join(', ')}\n`;
  }
  
  // Contact information in compact format
  if (step.contact) {
    result += "CONTACT:\n";
    if (step.contact.entityInCharge) {
      const entity = step.contact.entityInCharge;
      result += `Entity: ${entity.name}\n`;
      
      // Combine contact details to save space
      const contactDetails = [];
      if (entity.firstPhone) contactDetails.push(`Phone: ${entity.firstPhone}`);
      if (entity.firstEmail) contactDetails.push(`Email: ${entity.firstEmail}`);
      if (entity.firstWebsite) contactDetails.push(`Web: ${entity.firstWebsite}`);
      
      if (contactDetails.length > 0) {
        result += `${contactDetails.join(' | ')}\n`;
      }
      
      // Only include address if available
      if (entity.address) {
        result += `Address: ${entity.address}\n`;
      }
    }
    
    // Add unit/person info only if name is provided (save space)
    if (step.contact.unitInCharge?.name) {
      result += `Unit: ${step.contact.unitInCharge.name}\n`;
    }
    if (step.contact.personInCharge?.name) {
      result += `Contact: ${step.contact.personInCharge.name}`;
      if (step.contact.personInCharge.profession) {
        result += ` (${step.contact.personInCharge.profession})`;
      }
      result += '\n';
    }
  }
  
  // Requirements in compact format
  if (step.requirements?.length) {
    result += "REQUIREMENTS:\n";
    step.requirements.forEach((req: any) => {
      // Combine all requirement details in one line
      let reqLine = `- ${req.name}`;
      
      if (req.nbOriginal || req.nbCopy || req.nbAuthenticated) {
        const copies = [];
        if (req.nbOriginal) copies.push(`${req.nbOriginal} orig`);
        if (req.nbCopy) copies.push(`${req.nbCopy} copy`);
        if (req.nbAuthenticated) copies.push(`${req.nbAuthenticated} auth`);
        reqLine += ` (${copies.join(', ')})`;
      }
      
      result += reqLine + '\n';
      
      // Only add comments if they provide valuable information
      if (req.comments) {
        result += `  Note: ${req.comments}\n`;
      }
    });
  }
  
  // Results/outputs in compact format
  if (step.results?.length) {
    result += "OUTPUTS:\n";
    step.results.forEach((res: any) => {
      result += `- ${res.name}${res.isFinalResult ? " [FINAL]" : ""}\n`;
    });
  }
  
  // Timeframes in compact format
  if (step.timeframe) {
    result += "TIMEFRAME: ";
    const tf = step.timeframe;
    const times = [];
    
    if (tf.timeSpentAtTheCounter?.minutes?.max) {
      times.push(`${tf.timeSpentAtTheCounter.minutes.max}min at counter`);
    }
    if (tf.waitingTimeInLine?.minutes?.max) {
      times.push(`${tf.waitingTimeInLine.minutes.max}min wait`);
    }
    if (tf.waitingTimeUntilNextStep?.days?.max) {
      times.push(`${tf.waitingTimeUntilNextStep.days.max} days processing`);
    }
    
    if (times.length > 0) {
      result += times.join(' + ') + '\n';
    } else {
      result += "Not specified\n";
    }
  }
  
  // Costs in compact format
  if (step.costs?.length) {
    result += "COSTS:\n";
    step.costs.forEach((cost: any) => {
      if (cost.value) {
        if (cost.operator === 'percentage') {
          result += `- ${cost.value}% ${cost.parameter || ''}`;
        } else {
          result += `- ${cost.value} ${cost.unit}`;
        }
        
        if (cost.comments) {
          result += ` (${cost.comments})`;
        }
        result += '\n';
      }
    });
  }
  
  // Only include legal references if present
  if (step.laws?.length) {
    result += "LEGAL REFS: ";
    result += step.laws.map((law: any) => law.name).join(' | ') + '\n';
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
          
          // Format a summary of procedures for the text response - more compact format
          let proceduresSummary = `Found ${proceduresArray.length} procedures:\n\n`;
          
          if (proceduresArray.length > 0) {
            proceduresArray.slice(0, 20).forEach((proc: any, index: number) => {
              const id = proc.id || 'N/A';
              const name = proc.fullName || proc.name || 'Unknown';
              // Use online indicator instead of text to save space
              const online = proc.isOnline ? ' [ONLINE]' : '';
              
              // Only include abbreviated description if available
              let description = '';
              if (proc.explanatoryText) {
                const maxLength = 80; // Much shorter description to save context
                description = proc.explanatoryText.length > maxLength ? 
                  `\n   ${proc.explanatoryText.substring(0, maxLength)}...` : 
                  `\n   ${proc.explanatoryText}`;
              }
              
              proceduresSummary += `${index + 1}. ${name}${online} (ID:${id})${description}\n`;
            });
            
            // Add note about truncated results
            if (proceduresArray.length > 20) {
              proceduresSummary += `\n... and ${proceduresArray.length - 20} more. Use searchProcedures to narrow results.`;
            }
          } else {
            proceduresSummary += "No procedures found.";
          }
          
          logger.log(`LIST_PROCEDURES returning ${proceduresArray.length} procedures`);
          
          // Send only essential fields to save context space
          const essentialProcedures = proceduresArray.map(proc => ({
            id: proc.id,
            name: proc.fullName || proc.name,
            isOnline: proc.isOnline || false,
            ...(proc.parentName ? { parentName: proc.parentName } : {})
          }));
          
          return {
            content: [
              { 
                type: "text", 
                text: proceduresSummary
              },
              {
                type: "text",
                text: "```json\n" + JSON.stringify(essentialProcedures, null, 2) + "\n```",
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
          
          // Format procedure data for LLM consumption with context optimization
          let formattedProcedure = formatProcedureForLLM({
            ...procedure,
            resume,
            totals
          });
          
          logger.log(`Successfully retrieved details for procedure ID ${procedureId}`);
          
          // Return only essential structured data to save context space
          const essentialData = {
            id: procedure.id,
            name: procedure.name,
            steps: procedure.data?.blocks?.[0]?.steps?.map((step: any) => ({
              id: step.id,
              name: step.name,
              isOnline: step.isOnline || false,
              entityName: step.contact?.entityInCharge?.name
            })) || []
          };
          
          return {
            content: [
              { 
                type: "text", 
                text: formattedProcedure
              },
              {
                type: "text",
                text: "```json\n" + JSON.stringify(essentialData, null, 2) + "\n```",
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
          
          // Format step data for LLM consumption using context-optimized formatter
          const formattedStep = formatStepForLLM(step);
          
          // Create essential data object with only the necessary fields
          const essentialStepData = {
            id: step.id,
            name: step.name,
            procedureId,
            isOnline: step.isOnline || (step.online && !!step.online.url) || false,
            entityName: step.contact?.entityInCharge?.name,
            // Only include these if present
            ...(step.online?.url ? { onlineUrl: step.online.url } : {}),
            ...(step.requirements ? { 
              requirementCount: step.requirements.length,
              requirements: step.requirements.map(r => r.name)
            } : {}),
            ...(step.costs ? {
              costCount: step.costs.length,
              hasCosts: step.costs.length > 0
            } : {})
          };
          
          return {
            content: [
              { 
                type: "text", 
                text: formattedStep
              },
              {
                type: "text",
                text: "```json\n" + JSON.stringify(essentialStepData, null, 2) + "\n```",
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

          // Format results for display - compact format with essential info
          let searchResults = `Found ${apiResults.length} procedures`;
          if (query) searchResults += ` matching "${query}"`;
          searchResults += ':\n\n';
          
          if (apiResults.length > 0) {
            // Show first 10 results in compact format
            apiResults.slice(0, 10).forEach((proc: any, index: number) => {
              const id = proc.id || 'N/A';
              const name = proc.fullName || proc.name || 'Unknown';
              const online = proc.isOnline ? ' [ONLINE]' : '';
              
              searchResults += `${index + 1}. ${name}${online} (ID:${id})\n`;
            });
            
            if (apiResults.length > 10) {
              searchResults += `\n... and ${apiResults.length - 10} more results.`;
            }
          } else {
            searchResults += "No matching procedures found.";
          }
          
          // Only pass essential data in the JSON response to save context
          const essentialResults = apiResults.map((proc: any) => ({
            id: proc.id,
            name: proc.fullName || proc.name,
            isOnline: proc.isOnline || false,
            // Include parent name only if it exists and differs from the name
            ...(proc.parentName && proc.parentName !== proc.name ? { parentName: proc.parentName } : {})
          }));
          
          return {
            content: [
              { 
                type: "text", 
                text: searchResults
              },
              {
                type: "text",
                text: "```json\n" + JSON.stringify(essentialResults, null, 2) + "\n```",
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