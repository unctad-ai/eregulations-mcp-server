import {
  DataFormatter,
  FormattedProcedureList,
  ObjectiveData,
} from "./types.js"; // Use ObjectiveData input, FormattedProcedureList output

/**
 * Formats procedure search results optimized for LLMs.
 * NOTE: Takes ObjectiveData[] as input due to API change, but formats it as a procedure list.
 */
export class SearchProceduresFormatter
  implements DataFormatter<ObjectiveData[], FormattedProcedureList>
{
  // Renamed class
  /**
   * Format procedure search results for LLM consumption.
   * @param results The search result data to format (ObjectiveWithDescriptionBaseModel[]).
   * @param keyword The search keyword used.
   * @param maxItems Optional maximum number of items to include in the formatted text. Defaults to showing all.
   * @param maxLength Optional maximum length for descriptions in the formatted text. Defaults to showing full description.
   * @returns Formatted procedure search results text and essential data.
   */
  public format(
    results: ObjectiveData[],
    keyword?: string,
    maxItems?: number,
    maxLength?: number
  ): FormattedProcedureList {
    // Renamed variable
    if (!results || !Array.isArray(results) || results.length === 0) {
      return {
        text: `No procedures found matching "${keyword || "search term"}"`,
        data: [],
      };
    }

    const formattedText = this.formatText(
      results,
      keyword,
      maxItems,
      maxLength
    ); // Pass new params
    const essentialData = this.extractEssentialData(results); // Pass results

    return {
      text: formattedText,
      data: essentialData,
    };
  }

  /**
   * Extract essential data from search results (objectives) for procedure list.
   * @param results The full search results (objectives).
   * @returns A simplified array with essential fields (id, name, description).
   */
  private extractEssentialData(results: ObjectiveData[]): any[] {
    return results.map((res) => ({
      id: res.id,
      name: res.name,
      ...(res.description ? { description: res.description } : {}),
    }));
  }

  /**
   * Format search results (objectives) as human-readable text representing procedures.
   * @param results The search data to format (objectives).
   * @param keyword The search keyword used.
   * @param maxItems Optional maximum number of items to include. If undefined, all items are included.
   * @param maxLength Optional maximum length for descriptions. If undefined, full description is included.
   * @returns Formatted text optimized for LLM context.
   */
  private formatText(
    results: ObjectiveData[],
    keyword?: string,
    maxItems?: number,
    maxLength?: number
  ): string {
    const searchTerm = keyword ? ` for "${keyword}"` : "";
    const resultCount = results.length;

    let header = `Found ${resultCount} procedure${
      resultCount !== 1 ? "s" : ""
    }${searchTerm}:\n\n`; // Use "procedure" in text

    const shownResults =
      maxItems !== undefined && resultCount > maxItems
        ? results.slice(0, maxItems)
        : results;

    if (shownResults.length > 0) {
      shownResults.forEach((res, index) => {
        const id = res.id || "N/A";
        const name = res.name || "Unknown";

        let description = "";
        if (res.description) {
          description =
            maxLength !== undefined && res.description.length > maxLength
              ? `\n   ${res.description.substring(0, maxLength)}...`
              : `\n   ${res.description}`;
        }

        header += `${index + 1}. ${name} (ID:${id})${description}\n`;
      });

      if (maxItems !== undefined && resultCount > maxItems) {
        header += `\n... and ${resultCount - maxItems} more results.`;
      }

      header += `\n\nTo get details about a specific procedure, use the getProcedureDetails tool with the procedure ID.`; // Keep instruction
    } else {
      header += "No procedures found.";
    }

    return header;
  }
}
