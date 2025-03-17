import { describe, it, expect } from 'vitest';
import { ProcedureListFormatter } from '../../mcp-capabilities/tools/formatters/procedure-list-formatter.js';
import { ProcedureData } from '../../mcp-capabilities/tools/formatters/types.js';

describe('ProcedureListFormatter', () => {
  const formatter = new ProcedureListFormatter();

  const mockProcedures: ProcedureData[] = [
    {
      id: 1,
      name: "Import License",
      fullName: "Apply for Import License",
      explanatoryText: "Process for obtaining an import license",
      isOnline: true
    },
    {
      id: 2,
      name: "Business Registration",
      fullName: "Register New Business",
      explanatoryText: "Register a new business entity",
      isOnline: false,
      parentName: "Business Services"
    },
    {
      id: 3,
      name: "Tax Certificate",
      fullName: "Apply for Tax Certificate",
      isOnline: true,
      parentName: "Tax Services"
    }
  ];

  it('formats procedure list with all fields present', () => {
    const result = formatter.format(mockProcedures);
    
    // Verify text format is optimized for context
    expect(result.text).toContain('Found 3 procedures:');
    expect(result.text).toContain('Apply for Import License [ONLINE] (ID:1)');
    expect(result.text).toContain('Register New Business (ID:2)');
    expect(result.text).toContain('Apply for Tax Certificate [ONLINE] (ID:3)');
    
    // Verify essential data is extracted
    expect(result.data).toEqual([
      {
        id: 1,
        name: "Apply for Import License",
        isOnline: true
      },
      {
        id: 2,
        name: "Register New Business",
        isOnline: false,
        parentName: "Business Services"
      },
      {
        id: 3,
        name: "Apply for Tax Certificate",
        isOnline: true,
        parentName: "Tax Services"
      }
    ]);
  });

  it('handles empty procedure list', () => {
    const result = formatter.format([]);
    expect(result.text).toBe('No procedures available');
    expect(result.data).toEqual([]);
  });

  it('handles null/undefined procedure list', () => {
    const resultNull = formatter.format(null as any);
    expect(resultNull.text).toBe('No procedures available');
    expect(resultNull.data).toEqual([]);

    const resultUndefined = formatter.format(undefined as any);
    expect(resultUndefined.text).toBe('No procedures available');
    expect(resultUndefined.data).toEqual([]);
  });

  it('truncates large lists in text output but keeps full data', () => {
    const largeProcedureList = Array.from({ length: 25 }, (_, i) => ({
      id: i + 1,
      name: `Procedure ${i + 1}`,
      isOnline: i % 2 === 0
    }));

    const result = formatter.format(largeProcedureList);
    
    // Text should be truncated
    expect(result.text).toContain('... and 5 more');
    // But data should contain all items
    expect(result.data.length).toBe(25);
  });

  it('optimizes descriptions in text output', () => {
    const proceduresWithLongDesc = [
      {
        id: 1,
        name: "Test Procedure",
        explanatoryText: "A".repeat(200)
      }
    ];

    const result = formatter.format(proceduresWithLongDesc);
    const descriptionLine = result.text.split('\n').find(line => line.includes('A'));
    expect(descriptionLine?.length).toBeLessThan(100); // Should be truncated
    expect(descriptionLine).toContain('...');
  });
});