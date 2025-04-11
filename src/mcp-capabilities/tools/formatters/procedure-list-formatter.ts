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
   * @returns Formatted procedure list text and essential data
   */
  public format(
    procedures: ProcedureData[],
    return_data = false
  ): FormattedProcedureList {
    if (!procedures || !Array.isArray(procedures) || procedures.length === 0) {
      return {
        text: "No procedures available",
        data: [],
      };
    }

    // Extract and format the text representation
    const formattedText = this.formatText(procedures);

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
   * @returns Formatted text optimized for LLM context window
   */
  private formatText(procedures: ProcedureData[]): string {
    // Format a summary of procedures for the text response - more compact format
    let proceduresSummary = `Found ${procedures.length} procedures:\n\n`;

    if (procedures.length > 0) {
      // Always show all procedures now
      const shownProcedures = procedures;

      shownProcedures.forEach((proc, index) => {
        const id = proc.id || "N/A";
        const name = proc.fullName || proc.name || "Unknown";
        // Use online indicator instead of text to save space
        const online = proc.isOnline ? " [ONLINE]" : "";

        // Only include abbreviated description if available
        let description = "";
        if (proc.explanatoryText) {
          // Always show full description
          description = `\n   ${proc.explanatoryText}`;
        }

        proceduresSummary += `${
          index + 1
        }. ${name}${online} (ID:${id})${description}\n`;
      });
    } else {
      proceduresSummary += "No procedures found.";
    }

    return proceduresSummary;
  }
}
