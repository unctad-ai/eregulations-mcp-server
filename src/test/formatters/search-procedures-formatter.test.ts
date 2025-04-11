import { describe, it, expect } from "vitest";
import { SearchProceduresFormatter } from "../../mcp-capabilities/tools/formatters/search-procedures-formatter.js";
import type { ObjectiveData } from "../../mcp-capabilities/tools/formatters/types.js";

describe("SearchProceduresFormatter", () => {
  const formatter = new SearchProceduresFormatter();

  const mockObjectives: ObjectiveData[] = [
    {
      id: 101,
      name: "Import General Goods",
      description: "Objective for general imports.",
    },
    {
      id: 102,
      name: "Export Flowers",
      description: "Objective for exporting flowers.",
    },
    { id: 103, name: "Transit Permit" }, // Objective without description
  ];

  it("should format a list of objectives correctly", () => {
    const keyword = "goods";
    const result = formatter.format(mockObjectives, keyword);

    // Check text format
    expect(result.text).toContain('Found 3 procedures for "goods":');
    expect(result.text).toContain(
      "1. Import General Goods (ID:101)\n   Objective for general imports."
    );
    expect(result.text).toContain(
      "2. Export Flowers (ID:102)\n   Objective for exporting flowers."
    );
    expect(result.text).toContain("3. Transit Permit (ID:103)\n"); // No description line
    expect(result.text).toContain(
      "To get details about a specific procedure, use the getProcedureDetails tool"
    );

    // Check data format
    expect(result.data).toEqual([
      {
        id: 101,
        name: "Import General Goods",
        description: "Objective for general imports.",
      },
      {
        id: 102,
        name: "Export Flowers",
        description: "Objective for exporting flowers.",
      },
      { id: 103, name: "Transit Permit" },
    ]);
  });

  it("should handle empty input array", () => {
    const result = formatter.format([], "empty");
    expect(result.text).toContain('No procedures found matching "empty"');
    expect(result.data).toEqual([]);
  });

  it("should handle null or undefined input", () => {
    const resultNull = formatter.format(null as any, "null");
    expect(resultNull.text).toContain('No procedures found matching "null"');
    expect(resultNull.data).toEqual([]);

    const resultUndefined = formatter.format(undefined as any, "undefined");
    expect(resultUndefined.text).toContain(
      'No procedures found matching "undefined"'
    );
    expect(resultUndefined.data).toEqual([]);
  });

  it("should include all items and full descriptions in output", () => {
    const longDesc =
      "This is a very long description that previously might have been truncated.";
    const manyObjectives: ObjectiveData[] = [
      ...Array.from({ length: 25 }, (_, i) => ({
        id: 300 + i,
        name: `Procedure ${i + 1}`,
        description: `Desc ${i + 1}`,
      })),
      { id: 400, name: "Long Desc Proc", description: longDesc },
    ];

    const result = formatter.format(manyObjectives, "many");

    // Check that all items are listed
    expect(result.text).toContain(`25. Procedure 25 (ID:324)`);
    expect(result.text).toContain(`26. Long Desc Proc (ID:400)`);
    // Check that the long description is NOT truncated
    expect(result.text).toContain(`\n   ${longDesc}\n`);
    expect(result.text).not.toContain("..."); // No truncation message
    // Check data still contains all items
    expect(result.data.length).toBe(26);
  });

  it("should handle missing keyword gracefully", () => {
    const result = formatter.format(mockObjectives); // No keyword provided
    expect(result.text).toContain("Found 3 procedures:"); // No 'for "keyword"' part
    expect(result.data.length).toBe(3);
  });
});
