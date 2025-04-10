import { zodToJsonSchema } from "zod-to-json-schema";
import { ERegulationsApi } from "../../../services/eregulations-api.js";
import { formatters } from "../formatters/index.js";
import type { ToolHandler } from "./types.js";
import { GetProcedureStepSchema, ToolName } from "../schemas.js";
import { logger } from "../../../utils/logger.js";
import { z } from "zod";

// Define the specific type for args based on the schema
type GetProcedureStepArgs = z.infer<typeof GetProcedureStepSchema>;

export function createGetProcedureStepHandler(
  api: ERegulationsApi
): ToolHandler {
  return {
    name: ToolName.GET_PROCEDURE_STEP,
    description: `Get information about a specific step within a procedure.`,
    inputSchema: zodToJsonSchema(GetProcedureStepSchema),
    inputSchemaDefinition: GetProcedureStepSchema,
    handler: async (args: any) => {
      try {
        // Use the inferred type for args
        const { procedureId, stepId } = args as GetProcedureStepArgs;

        logger.log(
          `Handling GET_PROCEDURE_STEP request for procedure ${procedureId}, step ${stepId}`
        );

        const step = await api.getProcedureStep(procedureId, stepId);

        // Use the step formatter - get result (data part ignored)
        const formattedResult = formatters.step.format(step);

        logger.log(`GET_PROCEDURE_STEP returning step ${step.name}`);

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
        return {
          content: [
            {
              type: "text",
              text: `Error retrieving step details: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    },
  };
}
