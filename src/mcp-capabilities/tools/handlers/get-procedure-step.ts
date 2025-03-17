import { zodToJsonSchema } from "zod-to-json-schema";
import { ERegulationsApi } from "../../../services/eregulations-api.js";
import { formatters } from "../formatters/index.js";
import { logger } from "../../../utils/logger.js";
import type { ToolHandler } from "./types.js";
import { GetProcedureStepSchema, ToolName } from "../schemas.js";

export function createGetProcedureStepHandler(api: ERegulationsApi): ToolHandler {
  return {
    name: ToolName.GET_PROCEDURE_STEP,
    description: "Get information about a specific step within a procedure",
    inputSchema: zodToJsonSchema(GetProcedureStepSchema),
    handler: async (args: any) => {
      try {
        const { procedureId, stepId } = args;
        const step = await api.getProcedureStep(procedureId, stepId);
        
        // Use the step formatter to format the data for LLM consumption
        const formattedResult = formatters.step.format(step);
        
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
  };
}