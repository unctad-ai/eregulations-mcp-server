import { zodToJsonSchema } from "zod-to-json-schema";
import { ERegulationsApi } from "../../../services/eregulations-api.js";
import { formatters } from "../formatters/index.js";
import { logger } from "../../../utils/logger.js";
import type { ToolHandler } from "./types.js";
import { ListProceduresSchema, ToolName } from "../schemas.js";
import { z } from "zod";

// Define the specific type for args based on the schema
type ListProceduresArgs = z.infer<typeof ListProceduresSchema>;

export function createListProceduresHandler(api: ERegulationsApi): ToolHandler {
  return {
    name: ToolName.LIST_PROCEDURES,
    description: `List all available procedures in the eRegulations system.`,
    inputSchema: zodToJsonSchema(ListProceduresSchema),
    inputSchemaDefinition: ListProceduresSchema,
    handler: async (args: any) => {
      try {
        // Use the inferred type for args
        // const { max_items, max_length } = args as ListProceduresArgs; // Removed

        logger.log(`Handling LIST_PROCEDURES request`);
        // Removed logging for max_items, max_length

        const procedures = await api.getProceduresList();

        // Use the dedicated formatter, always requesting text only
        const formattedResult = formatters.procedureList.format(
          procedures,
          false
          // Removed max_items, max_length
        );

        logger.log(`LIST_PROCEDURES returning ${procedures.length} procedures`);

        // Always return only text content
        return {
          content: [
            {
              type: "text",
              text: formattedResult.text,
            },
          ],
        };
      } catch (error) {
        logger.error(`Error in LIST_PROCEDURES handler:`, error);
        return {
          content: [
            {
              type: "text",
              text: `Error retrieving procedures: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    },
  };
}
