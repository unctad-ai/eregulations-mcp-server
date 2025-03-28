import { zodToJsonSchema } from "zod-to-json-schema";
import { ERegulationsApi } from "../../../services/eregulations-api.js";
import { formatters } from "../formatters/index.js";
import { logger } from "../../../utils/logger.js";
import type { ToolHandler } from "./types.js";
import { ListProceduresSchema, ToolName } from "../schemas.js";

export function createListProceduresHandler(api: ERegulationsApi): ToolHandler {
  return {
    name: ToolName.LIST_PROCEDURES,
    description: `List all available procedures in the eRegulations system.`,
    inputSchema: zodToJsonSchema(ListProceduresSchema),
    handler: async () => {
      try {
        logger.log(`Handling LIST_PROCEDURES request`);
        const procedures = await api.getProceduresList();
        
        // Use the dedicated formatter to format the procedures list
        const return_data = false
        const formattedResult = formatters.procedureList.format(procedures, return_data);
        
        logger.log(`LIST_PROCEDURES returning ${procedures.length} procedures`);
        
        if (!return_data) {
          return {
            content: [
              { 
                type: "text", 
                text: formattedResult.text
              }
            ]
          };
        }

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
  };
}