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
    handler: async (args: any) => {
      try {
        // Use the inferred type for args, providing defaults for optional params
        const {
          return_data = false,
          max_items,
          max_length,
        } = args as ListProceduresArgs;
        logger.log(`Handling LIST_PROCEDURES request`);
        if (return_data) logger.log(`  return_data: true`);
        if (max_items) logger.log(`  max_items: ${max_items}`);
        if (max_length) logger.log(`  max_length: ${max_length}`);

        const procedures = await api.getProceduresList();

        // Use the dedicated formatter to format the procedures list
        const formattedResult = formatters.procedureList.format(
          procedures,
          return_data,
          max_items,
          max_length
        );

        logger.log(`LIST_PROCEDURES returning ${procedures.length} procedures`);

        if (!return_data) {
          return {
            content: [
              {
                type: "text",
                text: formattedResult.text,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: formattedResult.text,
            },
            {
              type: "text",
              text:
                "```json\n" +
                JSON.stringify(formattedResult.data, null, 2) +
                "\n```",
              annotations: {
                role: "data",
              },
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
