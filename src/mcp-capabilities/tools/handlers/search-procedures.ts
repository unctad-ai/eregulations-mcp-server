import { zodToJsonSchema } from "zod-to-json-schema";
import { ERegulationsApi } from "../../../services/eregulations-api.js";
import { formatters } from "../formatters/index.js";
import { logger } from "../../../utils/logger.js";
import type { ToolHandler } from "./types.js";
import { SearchProceduresSchema, ToolName } from "../schemas.js";

export function createSearchProceduresHandler(api: ERegulationsApi): ToolHandler {
  return {
    name: ToolName.SEARCH_PROCEDURES,
    description: "Search for procedures using text search",
    inputSchema: zodToJsonSchema(SearchProceduresSchema),
    handler: async (args: any) => {
      try {
        const { query } = args;
        const results = await api.searchByName(query || '');
        
        // Use the search formatter to format the data for LLM consumption
        const formattedResult = formatters.search.format({ 
          results, 
          query 
        });
        
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
              text: `Error searching procedures: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  };
}