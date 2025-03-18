import { DataFormatter, FormattedProcedureSearchResults, ProcedureData } from './types.js';

/**
 * Formats search results data in a way optimized for LLMs with context length constraints
 */
export class SearchFormatter implements DataFormatter<{results: ProcedureData[], query?: string, return_data?: boolean}, FormattedProcedureSearchResults> {
  /**
   * Format search results data for LLM consumption
   * @param data Object containing search results and optional query
   * @returns Formatted search results text and essential data
   */
  public format(data: {results: ProcedureData[], query?: string, return_data?: boolean}): FormattedProcedureSearchResults {
    const { results, query, return_data = false } = data;
    
    if (!results || !Array.isArray(results) || results.length === 0) {
      return {
        text: `No procedures found${query ? ` matching "${query}"` : ''}`,
        data: []
      };
    }
    
    // Extract and format the text representation
    const formattedText = this.formatText(results, query);
    
    // Extract essential data for structured representation
    const essentialData = return_data ? this.extractEssentialData(results) : [];
    
    return {
      text: formattedText,
      data: essentialData
    };
  }

  /**
   * Extract only the essential data needed for LLM reasoning
   * @param results The search results data
   * @returns A simplified array with essential fields
   */
  private extractEssentialData(results: ProcedureData[]): any[] {
    return results.map(proc => ({
      id: proc.id,
      name: proc.fullName || proc.name,
      isOnline: proc.isOnline || false,
      // Include parent name only if it exists and differs from the name
      ...(proc.parentName && proc.parentName !== proc.name ? { parentName: proc.parentName } : {})
    }));
  }

  /**
   * Format search results data as human-readable text
   * @param results The search results data to format
   * @param query Optional search query for context
   * @returns Formatted text optimized for LLM context window
   */
  private formatText(results: ProcedureData[], query?: string): string {
    // Format search results for display - compact format with essential info
    let searchResults = `Found ${results.length} procedures`;
    if (query) searchResults += ` matching "${query}"`;
    searchResults += ':\n\n';
    
    if (results.length > 0) {
      results.forEach((proc: any, index: number) => {
        const id = proc.id || 'N/A';
        const name = proc.fullName || proc.name || 'Unknown';
        const online = proc.isOnline ? ' [ONLINE]' : '';
        
        searchResults += `${index + 1}. ${name}${online} (ID:${id})\n`;
      });
    } else {
      searchResults += "No matching procedures found.";
    }
    
    return searchResults;
  }
}