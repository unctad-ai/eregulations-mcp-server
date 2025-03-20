import { zodToJsonSchema } from "zod-to-json-schema";
import { ERegulationsApi } from "../../../services/eregulations-api.js";
import { formatters } from "../formatters/index.js";
import { logger } from "../../../utils/logger.js";
import type { ToolHandler } from "./types.js";
import { GetProcedureDetailsSchema, ToolName } from "../schemas.js";

export function createGetProcedureDetailsHandler(api: ERegulationsApi): ToolHandler {
  return {
    name: ToolName.GET_PROCEDURE_DETAILS,
    description: `Get detailed information about a specific procedure by ID. Source: ${api.baseUrl}`,
    inputSchema: zodToJsonSchema(GetProcedureDetailsSchema),
    handler: async (args: any) => {
      try {
        const { procedureId } = args;
        logger.log(`Handling GET_PROCEDURE_DETAILS request for procedure ID ${procedureId}`);
        
        // Get the basic procedure details
        const procedure = await api.getProcedureById(procedureId);
        
        // The following API calls are not currently used in the formatter but may be used in the future
        // Uncomment if needed:
        /*
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
        */
        
        // Use the procedure formatter to format the data for LLM consumption
        const formattedResult = formatters.procedure.format({
          ...procedure,
          // resume,
          // totals
        });
        
        logger.log(`Successfully retrieved details for procedure ID ${procedureId}`);
        
        return {
          content: [
            { 
              type: "text", 
              text: formattedResult.text
            },
            {
              type: "text",
              text: "```json\n" + JSON.stringify(formattedResult.data, null, 2) + "\n```",
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
  };
}