import { zodToJsonSchema } from "zod-to-json-schema";
import { ERegulationsApi } from "../../../services/eregulations-api.js";
import { formatters } from "../formatters/index.js";
import { logger } from "../../../utils/logger.js";
import type { ToolHandler } from "./types.js";
import { GetProcedureDetailsSchema, ToolName } from "../schemas.js";
import { z } from "zod";

// Define the specific type for args based on the schema
type GetProcedureDetailsArgs = z.infer<typeof GetProcedureDetailsSchema>;

export function createGetProcedureDetailsHandler(
  api: ERegulationsApi
): ToolHandler {
  return {
    name: ToolName.GET_PROCEDURE_DETAILS,
    description: `Get detailed information about a specific procedure by ID.`,
    inputSchema: zodToJsonSchema(GetProcedureDetailsSchema),
    inputSchemaDefinition: GetProcedureDetailsSchema,
    handler: async (args: any) => {
      try {
        // Use the inferred type for args
        const { procedureId } = args as GetProcedureDetailsArgs;

        logger.log(
          `Handling GET_PROCEDURE_DETAILS request for ID ${procedureId}`
        );

        const procedure = await api.getProcedureById(procedureId);

        // Use the formatter - Get result (data part will be ignored)
        const formattedResult = formatters.procedure.format(procedure);

        logger.log(
          `GET_PROCEDURE_DETAILS returning details for ${procedure.name}`
        );

        // Always return only text content
        return {
          content: [
            {
              type: "text",
              text: formattedResult.text, // Data part of formattedResult is ignored
            },
          ],
        };
      } catch (error: any) {
        const errorMessage = error.message || String(error);
        logger.error(
          `Error in GET_PROCEDURE_DETAILS handler for ID ${args?.procedureId}:`,
          errorMessage
        );

        return {
          content: [
            {
              type: "text",
              text: `Error retrieving procedure details: ${errorMessage}\n\nValid procedure IDs can be found by using the listProcedures tool first.`,
            },
          ],
        };
      }
    },
  };
}
