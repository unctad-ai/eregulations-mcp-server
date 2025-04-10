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
        const { procedureId, max_length } = args as GetProcedureDetailsArgs;
        logger.log(
          `Handling GET_PROCEDURE_DETAILS request for procedure ID ${procedureId}`
        );
        if (max_length) logger.log(`  max_length: ${max_length}`);

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
        const formattedResult = formatters.procedure.format(
          {
            ...procedure,
            // resume,
            // totals
          },
          max_length
        );

        logger.log(
          `Successfully retrieved details for procedure ID ${procedureId}`
        );

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
