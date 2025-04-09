import {
  DataFormatter,
  FormattedProcedureList,
  ProcedureData,
} from "./types.js";

/**
 * Formats procedure list data in a way optimized for LLMs with context length constraints
 */
export class ProcedureListFormatter
  implements DataFormatter<ProcedureData[], FormattedProcedureList>
{
  /**
   * Format procedure list data for LLM consumption
   * @param procedures The procedure list data to format
   * @param return_data Whether to include the essential data array.
   * @param maxItems Optional maximum number of items to include in the formatted text. Defaults to showing all.
   * @param maxLength Optional maximum length for descriptions in the formatted text. Defaults to showing full description.
   * @returns Formatted procedure list text and essential data
   */
  public format(
    procedures: ProcedureData[],
    return_data = false,
    maxItems?: number,
    maxLength?: number
  ): FormattedProcedureList {
    if (!procedures || !Array.isArray(procedures) || procedures.length === 0) {
      return {
        text: "No procedures available",
        data: [],
      };
    }

    // Extract and format the text representation
    const formattedText = this.formatText(procedures, maxItems, maxLength);

    // Extract essential data for structured representation
    const essentialData = return_data
      ? this.extractEssentialData(procedures)
      : [];

    return {
      text: formattedText,
      data: essentialData,
    };
  }

  /**
   * Extract only the essential data needed for LLM reasoning
   * @param procedures The full procedures list data
   * @returns A simplified array with essential fields
   */
  private extractEssentialData(procedures: ProcedureData[]): any[] {
    return procedures.map((proc) => ({
      id: proc.id,
      name: proc.fullName || proc.name,
      isOnline: proc.isOnline || false,
      ...(proc.parentName ? { parentName: proc.parentName } : {}),
    }));
  }

  /**
   * Format procedure list data as human-readable text
   * @param procedures The procedure list data to format
   * @param maxItems Optional maximum number of items to include in formatted text. If undefined, all items included.
   * @param maxLength Optional maximum length for descriptions. If undefined, full description is included.
   * @returns Formatted text optimized for LLM context window
   */
  private formatText(
    procedures: ProcedureData[],
    maxItems?: number,
    maxLength?: number
  ): string {
    // Format a summary of procedures for the text response - more compact format
    let proceduresSummary = `Found ${procedures.length} procedures:\n\n`;

    if (procedures.length > 0) {
      // Only limit the number of procedures shown if maxItems is explicitly set
      const shownProcedures = maxItems
        ? procedures.slice(0, maxItems)
        : procedures;

      shownProcedures.forEach((proc, index) => {
        const id = proc.id || "N/A";
        const name = proc.fullName || proc.name || "Unknown";
        // Use online indicator instead of text to save space
        const online = proc.isOnline ? " [ONLINE]" : "";

        // Only include abbreviated description if available
        let description = "";
        if (proc.explanatoryText) {
          // Only truncate if maxLength is provided and text is longer
          description =
            maxLength !== undefined && proc.explanatoryText.length > maxLength
              ? `\n   ${proc.explanatoryText.substring(0, maxLength)}...`
              : `\n   ${proc.explanatoryText}`;
        }

        proceduresSummary += `${
          index + 1
        }. ${name}${online} (ID:${id})${description}\n`;
      });

      // Add note about truncated results only if we actually limited the results
      if (maxItems && procedures.length > maxItems) {
        proceduresSummary += `\n... and ${procedures.length - maxItems} more.`;
      }
    } else {
      proceduresSummary += "No procedures found.";
    }

    return proceduresSummary;
  }
}
