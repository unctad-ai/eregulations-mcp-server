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

  it('formats search results with query context but no data by default', () => {
    const result = formatter.format({
      results: mockSearchResults,
      query: "import"
    });
    
    // Verify text format includes search context
    expect(result.text).toContain('Found 3 procedures matching "import"');
    expect(result.text).toContain('Apply for Import License [ONLINE] (ID:1)');
    expect(result.text).toContain('Register as Importer [ONLINE] (ID:2)');
    expect(result.text).toContain('File Import Declaration [ONLINE] (ID:3)');
    
    // Verify data is empty by default
    expect(result.data).toEqual([]);
  });

  it('formats search results with query context and data when return_data is true', () => {
    const result = formatter.format({
      results: mockSearchResults,
      query: "import",
      return_data: true
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

  it('formats search results without returning data when return_data is false', () => {
    const result = formatter.format({
      results: mockSearchResults,
      query: "import",
      return_data: false
    });
    
    // Verify text format includes search context
    expect(result.text).toContain('Found 3 procedures matching "import"');
    expect(result.text).toContain('Apply for Import License [ONLINE] (ID:1)');
    expect(result.text).toContain('Register as Importer [ONLINE] (ID:2)');
    expect(result.text).toContain('File Import Declaration [ONLINE] (ID:3)');
    
    // Verify data is empty
    expect(result.data).toEqual([]);
  });

  it('formats search results without query', () => {
    const result = formatter.format({
      results: mockSearchResults,
      return_data: false
    });
    
    expect(result.text).toContain('Found 3 procedures:');
    expect(result.text).not.toContain('matching');
    expect(result.data).toEqual([]);
  });

  it('handles empty results', () => {
    const result = formatter.format({
      results: [],
      query: "nonexistent",
      return_data: false
    });
    
    expect(result.text).toBe('No procedures found matching "nonexistent"');
    expect(result.data).toEqual([]);
  });

  it('handles null/undefined results', () => {
    const resultNull = formatter.format({
      results: null as any,
      query: "test",
      return_data: false
    });
    expect(resultNull.text).toBe('No procedures found matching "test"');
    expect(resultNull.data).toEqual([]);

    const resultUndefined = formatter.format({
      results: undefined as any,
      return_data: false
    });
    expect(resultUndefined.text).toBe('No procedures found');
    expect(resultUndefined.data).toEqual([]);
  });

  it('includes all items in text and data when return_data is true', () => {
    const largeResultSet = Array.from({ length: 15 }, (_, i) => ({
      id: i + 1,
      name: `Search Result ${i + 1}`,
      isOnline: i % 2 === 0
    }));

    const result = formatter.format({
      results: largeResultSet,
      query: "test",
      return_data: true
    });
    
    // Text should include all items
    const resultLines = result.text.split('\n').filter(line => line.match(/^\d+\./));
    expect(resultLines.length).toBe(15);
    expect(result.text).not.toContain('... and');
    // Data should contain all items when return_data is true
    expect(result.data.length).toBe(15);
  });

  it('includes all items in text but no data when return_data is false', () => {
    const largeResultSet = Array.from({ length: 15 }, (_, i) => ({
      id: i + 1,
      name: `Search Result ${i + 1}`,
      isOnline: i % 2 === 0
    }));

    const result = formatter.format({
      results: largeResultSet,
      query: "test",
      return_data: false
    });
    
    // Text should include all items
    const resultLines = result.text.split('\n').filter(line => line.match(/^\d+\./));
    expect(resultLines.length).toBe(15);
    expect(result.text).not.toContain('... and');
    // Data should be empty
    expect(result.data).toEqual([]);
  });

  it('formats results with parent context when return_data is true', () => {
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
      results: resultsWithParent,
      return_data: true
    });
    
    // Parent name should be included in data when return_data is true
    expect(result.data[0]).toHaveProperty('parentName', 'Parent');
    // Text should show the full hierarchical name
    expect(result.text).toContain('Parent > SubProcedure');
  });
});