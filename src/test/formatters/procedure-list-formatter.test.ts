import { describe, it, expect } from "vitest";
import { ProcedureListFormatter } from "../../mcp-capabilities/tools/formatters/procedure-list-formatter.js";
import { ProcedureData } from "../../mcp-capabilities/tools/formatters/types.js";

describe("ProcedureListFormatter", () => {
  const formatter = new ProcedureListFormatter();

  const mockProcedures: ProcedureData[] = [
    {
      id: 1,
      name: "Import License",
      fullName: "Apply for Import License",
      explanatoryText: "Process for obtaining an import license",
      isOnline: true,
    },
    {
      id: 2,
      name: "Business Registration",
      fullName: "Register New Business",
      explanatoryText: "Register a new business entity",
      isOnline: false,
      parentName: "Business Services",
    },
    {
      id: 3,
      name: "Tax Certificate",
      fullName: "Apply for Tax Certificate",
      isOnline: true,
      parentName: "Tax Services",
    },
  ];

  it("formats procedure list with all fields present", () => {
    const result = formatter.format(mockProcedures, true);

    // Verify text format is optimized for context
    expect(result.text).toContain("Found 3 procedures:");
    expect(result.text).toContain("Apply for Import License [ONLINE] (ID:1)");
    expect(result.text).toContain("Register New Business (ID:2)");
    expect(result.text).toContain("Apply for Tax Certificate [ONLINE] (ID:3)");

    // Verify essential data is extracted
    expect(result.data).toEqual([
      {
        id: 1,
        name: "Apply for Import License",
        isOnline: true,
      },
      {
        id: 2,
        name: "Register New Business",
        isOnline: false,
        parentName: "Business Services",
      },
      {
        id: 3,
        name: "Apply for Tax Certificate",
        isOnline: true,
        parentName: "Tax Services",
      },
    ]);
  });

  it("formats procedure list without data when return_data is false", () => {
    const result = formatter.format(mockProcedures, false);

    // Verify text format is present
    expect(result.text).toContain("Found 3 procedures:");
    expect(result.text).toContain("Apply for Import License [ONLINE] (ID:1)");
    expect(result.text).toContain("Register New Business (ID:2)");
    expect(result.text).toContain("Apply for Tax Certificate [ONLINE] (ID:3)");

    // Verify data is empty
    expect(result.data).toEqual([]);
  });

  it("handles empty procedure list", () => {
    const result = formatter.format([], false);
    expect(result.text).toBe("No procedures available");
    expect(result.data).toEqual([]);
  });

  it("handles null/undefined procedure list", () => {
    const resultNull = formatter.format(null as any, false);
    expect(resultNull.text).toBe("No procedures available");
    expect(resultNull.data).toEqual([]);

    const resultUndefined = formatter.format(undefined as any, false);
    expect(resultUndefined.text).toBe("No procedures available");
    expect(resultUndefined.data).toEqual([]);
  });

  it("includes all items in output regardless of list size when return_data is true", () => {
    const largeProcedureList = Array.from({ length: 25 }, (_, i) => ({
      id: i + 1,
      name: `Procedure ${i + 1}`,
      isOnline: i % 2 === 0,
    }));

    const result = formatter.format(largeProcedureList, true);

    // Text should include all items
    expect(result.text.split("\n").length).toBeGreaterThan(25); // Header + 25 items
    expect(result.text).not.toContain("... and");
    // Data should contain all items
    expect(result.data.length).toBe(25);
  });

  it("includes all items in text output and returns empty data when return_data is false", () => {
    const largeProcedureList = Array.from({ length: 25 }, (_, i) => ({
      id: i + 1,
      name: `Procedure ${i + 1}`,
      isOnline: i % 2 === 0,
    }));

    const result = formatter.format(largeProcedureList, false);

    // Text should include all items
    expect(result.text.split("\n").length).toBeGreaterThan(25); // Header + 25 items
    expect(result.text).not.toContain("... and");
    // Data should be empty
    expect(result.data).toEqual([]);
  });

  it("includes full descriptions in text output", () => {
    const longText = "A".repeat(200);
    const proceduresWithLongDesc = [
      {
        id: 1,
        name: "Test Procedure",
        explanatoryText: longText,
      },
    ];

    // Call format (maxLength parameter is removed)
    const result = formatter.format(proceduresWithLongDesc, false);

    const descriptionLine = result.text
      .split("\n")
      .find((line) => line.includes(longText)); // Find the line containing the full text

    expect(descriptionLine).toBeDefined();
    // Check that the line contains the full, untruncated description
    expect(descriptionLine).toContain(longText);
    // Check that the line does NOT end with '...'
    expect(descriptionLine!.endsWith("...")).toBe(false);
  });
});
