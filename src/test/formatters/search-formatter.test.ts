import { describe, it, expect } from 'vitest';
import { SearchFormatter } from '../../mcp-capabilities/tools/formatters/search-formatter.js';
import { ProcedureData } from '../../mcp-capabilities/tools/formatters/types.js';

describe('SearchFormatter', () => {
  const formatter = new SearchFormatter();

  const mockSearchResults: ProcedureData[] = [
    {
      id: 1,
      name: "Import License",
      fullName: "Apply for Import License",
      explanatoryText: "Process for obtaining an import license",
      isOnline: true
    },
    {
      id: 2,
      name: "Import Registration",
      fullName: "Register as Importer",
      explanatoryText: "Registration process for new importers",
      isOnline: true,
      parentName: "Import Services"
    },
    {
      id: 3,
      name: "Import Declaration",
      fullName: "File Import Declaration",
      isOnline: true,
      parentName: "Import Services"
    }
  ];

  it('formats search results with query context', () => {
    const result = formatter.format({
      results: mockSearchResults,
      query: "import"
    });
    
    // Verify text format includes search context
    expect(result.text).toContain('Found 3 procedures matching "import"');
    expect(result.text).toContain('Apply for Import License [ONLINE] (ID:1)');
    expect(result.text).toContain('Register as Importer [ONLINE] (ID:2)');
    expect(result.text).toContain('File Import Declaration [ONLINE] (ID:3)');
    
    // Verify essential data is extracted
    expect(result.data).toEqual([
      {
        id: 1,
        name: "Apply for Import License",
        isOnline: true
      },
      {
        id: 2,
        name: "Register as Importer",
        isOnline: true,
        parentName: "Import Services"
      },
      {
        id: 3,
        name: "File Import Declaration",
        isOnline: true,
        parentName: "Import Services"
      }
    ]);
  });

  it('formats search results without query', () => {
    const result = formatter.format({
      results: mockSearchResults
    });
    
    expect(result.text).toContain('Found 3 procedures:');
    expect(result.text).not.toContain('matching');
  });

  it('handles empty results', () => {
    const result = formatter.format({
      results: [],
      query: "nonexistent"
    });
    
    expect(result.text).toBe('No procedures found matching "nonexistent"');
    expect(result.data).toEqual([]);
  });

  it('handles null/undefined results', () => {
    const resultNull = formatter.format({
      results: null as any,
      query: "test"
    });
    expect(resultNull.text).toBe('No procedures found matching "test"');
    expect(resultNull.data).toEqual([]);

    const resultUndefined = formatter.format({
      results: undefined as any
    });
    expect(resultUndefined.text).toBe('No procedures found');
    expect(resultUndefined.data).toEqual([]);
  });

  it('truncates large result sets in text output but keeps full data', () => {
    const largeResultSet = Array.from({ length: 15 }, (_, i) => ({
      id: i + 1,
      name: `Search Result ${i + 1}`,
      isOnline: i % 2 === 0
    }));

    const result = formatter.format({
      results: largeResultSet,
      query: "test"
    });
    
    // Text should be truncated at 10 items
    expect(result.text).toContain('... and 5 more results');
    // Count number of result lines
    const resultLines = result.text.split('\n').filter(line => line.match(/^\d+\./));
    expect(resultLines.length).toBe(10);
    // But data should contain all items
    expect(result.data.length).toBe(15);
  });

  it('formats results with parent context when relevant', () => {
    const resultsWithParent: ProcedureData[] = [
      {
        id: 1,
        name: "SubProcedure",
        fullName: "Parent > SubProcedure",
        parentName: "Parent",
        isOnline: false
      }
    ];

    const result = formatter.format({
      results: resultsWithParent
    });
    
    // Parent name should be included in data when it differs from name
    expect(result.data[0]).toHaveProperty('parentName', 'Parent');
    // Text should show the full hierarchical name
    expect(result.text).toContain('Parent > SubProcedure');
  });
});