import { SearchProceduresSchema, ToolName } from "../schemas.js";
import { formatters } from "../formatters/index.js";
import { ERegulationsApi } from "../../../services/eregulations-api.js";
import { logger } from "../../../utils/logger.js";
import { ToolHandler } from "./types.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// Define the specific type for args based on the schema
type SearchProceduresArgs = z.infer<typeof SearchProceduresSchema>;

/**
 * Creates a handler for the searchProcedures tool
 * @param api The eRegulations API instance to use
 * @returns A handler for the searchProcedures tool
 */
export function createSearchProceduresHandler(
  api: ERegulationsApi
): ToolHandler {
  return {
    name: ToolName.SEARCH_PROCEDURES,
    description:
      "Search for procedures by keyword or phrase. The search uses OR logic between words in the keyword phrase.",
    inputSchema: zodToJsonSchema(SearchProceduresSchema),
    handler: async (args) => {
      // Use the inferred type for args
      const { keyword, max_items, max_length } = args as SearchProceduresArgs;
      logger.log(`Searching for procedures with keyword: ${keyword}`);
      if (max_items) logger.log(`  max_items: ${max_items}`);
      if (max_length) logger.log(`  max_length: ${max_length}`);

      try {
        // Search for objectives/procedures using the provided keyword
        // NOTE: API function still calls /Objectives/Search endpoint
        const results = await api.searchProcedures(keyword);

        // Format the search results using the procedure formatter
        // NOTE: Formatter still works on ObjectiveWithDescriptionBaseModel[] type
        const { text, data } = formatters.searchProcedures.format(
          results,
          keyword,
          max_items,
          max_length
        );

        return {
          content: [
            {
              type: "text",
              text: text,
            },
            {
              type: "text",
              text: "```json\n" + JSON.stringify(data, null, 2) + "\n```",
              annotations: {
                role: "data",
              },
            },
          ],
        };
      } catch (error) {
        logger.error(
          `Error searching procedures with keyword "${keyword}":`,
          error
        );
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text",
              text: `Error searching for procedures: ${errorMessage}`,
            },
          ],
        };
      }
    },
  };
}
