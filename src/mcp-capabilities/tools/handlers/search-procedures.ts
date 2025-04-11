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
    description: `Search for procedures by keyword or phrase. The search uses OR logic between words in the keyword phrase. For best results, prefer using a single, specific keyword whenever possible.`,
    inputSchema: zodToJsonSchema(SearchProceduresSchema),
    inputSchemaDefinition: SearchProceduresSchema,
    handler: async (args) => {
      // Use the inferred type for args
      const { keyword, max_items, max_length } = args as SearchProceduresArgs;
      logger.log(`Handling searchProcedures with keyword: ${keyword}`);
      if (max_items) logger.log(`  max_items: ${max_items}`);
      if (max_length) logger.log(`  max_length: ${max_length}`);

      try {
        const results = await api.searchProcedures(keyword);

        // Filter results to only include actual procedures based on links
        const filteredProcedures = results.filter(
          (item) =>
            item.links &&
            Array.isArray(item.links) &&
            item.links.some((link) => link && link.rel === "procedure")
        );

        logger.log(
          `searchProcedures API returned ${results.length} items, filtered to ${filteredProcedures.length} procedures`
        );

        // Format the filtered results using the search procedures formatter
        const formattedResult = formatters.searchProcedures.format(
          filteredProcedures, // Pass filtered procedures
          keyword, // Pass keyword for context
          max_items,
          max_length
        );

        logger.log(
          `searchProcedures found ${filteredProcedures.length} results`
        );

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
