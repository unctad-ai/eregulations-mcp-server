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
   * @returns Formatted procedure search results text and essential data.
   */
  public format(
    results: ObjectiveData[],
    keyword?: string
  ): FormattedProcedureList {
    // Renamed variable
    if (!results || !Array.isArray(results) || results.length === 0) {
      return {
        text: `No procedures found matching "${keyword || "search term"}"`,
        data: [],
      };
    }

    const formattedText = this.formatText(results, keyword); // Pass new params
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
   * @returns Formatted text optimized for LLM context.
   */
  private formatText(results: ObjectiveData[], keyword?: string): string {
    const searchTerm = keyword ? ` for "${keyword}"` : "";
    const resultCount = results.length;

    let header = `Found ${resultCount} procedure${
      resultCount !== 1 ? "s" : ""
    }${searchTerm}:\n\n`; // Use "procedure" in text

    const shownResults = results; // Always show all results now

    if (shownResults.length > 0) {
      shownResults.forEach((res, index) => {
        const id = res.id || "N/A";
        const name = res.name || "Unknown";

        let description = "";
        if (res.description) {
          description = `\n   ${res.description}`;
        }

        header += `${index + 1}. ${name} (ID:${id})${description}\n`;
      });

      header += `\n\nTo get details about a specific procedure, use the getProcedureDetails tool with the procedure ID.`; // Keep instruction
    } else {
      header += "No procedures found.";
    }

    return header;
  }
}
