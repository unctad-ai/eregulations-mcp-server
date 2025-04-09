import { describe, it, expect } from "vitest";
import { ProcedureFormatter } from "../../mcp-capabilities/tools/formatters/procedure-formatter.js";
import { ProcedureData } from "../../mcp-capabilities/tools/formatters/types.js";

describe("ProcedureFormatter", () => {
  const formatter = new ProcedureFormatter();

  const mockProcedure: ProcedureData = {
    id: 123,
    name: "Import License Application",
    fullName: "Apply for Import License",
    description: "Process for obtaining an import license for restricted goods",
    isOnline: true,
    data: {
      id: 123,
      name: "Import License Application",
      url: "https://example.com/import-license",
      blocks: [
        {
          steps: [
            {
              id: 1,
              name: "Submit Application",
              isOnline: true,
              online: {
                url: "https://submit.example.com",
              },
              contact: {
                entityInCharge: {
                  name: "Trade Authority",
                  firstPhone: "123-456-7890",
                  firstEmail: "trade@example.com",
                },
              },
              requirements: [
                {
                  name: "Business Registration",
                  nbOriginal: 1,
                  nbCopy: 2,
                },
              ],
              timeframe: {
                timeSpentAtTheCounter: {
                  minutes: { max: 30 },
                },
                waitingTimeUntilNextStep: {
                  days: { max: 5 },
                },
              },
              costs: [
                {
                  value: 100,
                  unit: "TZS",
                  comments: "Application Fee",
                },
              ],
            },
          ],
        },
      ],
    },
  };

  it("formats procedure with all fields present", () => {
    const result = formatter.format(mockProcedure);

    // Verify text format is optimized for context
    expect(result.text).toContain(
      "PROCEDURE: Apply for Import License (ID:123)"
    );
    expect(result.text).toContain("URL: https://example.com/import-license");
    expect(result.text).toContain(
      "DESC: Process for obtaining an import license for restricted goods"
    );
    expect(result.text).toContain("[ONLINE]");

    // Verify essential data is extracted
    expect(result.data).toEqual({
      id: 123,
      name: "Apply for Import License",
      isOnline: true,
      steps: [
        {
          id: 1,
          name: "Submit Application",
          isOnline: true,
          entityName: "Trade Authority",
        },
      ],
    });
  });

  it("handles missing fields gracefully", () => {
    const minimalProcedure: ProcedureData = {
      id: 456,
      name: "Basic Procedure",
    };

    const result = formatter.format(minimalProcedure);

    // Should not throw errors for missing fields
    expect(result.text).toContain("PROCEDURE: Basic Procedure (ID:456)");
    expect(result.data).toEqual({
      id: 456,
      name: "Basic Procedure",
      isOnline: false,
      steps: [],
    });
  });

  it("handles null/undefined procedure", () => {
    const resultNull = formatter.format(null as any);
    expect(resultNull.text).toBe("No procedure data available");
    expect(resultNull.data).toEqual({});

    const resultUndefined = formatter.format(undefined as any);
    expect(resultUndefined.text).toBe("No procedure data available");
    expect(resultUndefined.data).toEqual({});
  });

  it("optimizes long descriptions", () => {
    const longDescProcedure: ProcedureData = {
      id: 789,
      name: "Test Procedure",
      description: "A".repeat(300),
    };

    // Call format with an explicit maxLength to test truncation
    const maxLength = 180;
    const result = formatter.format(longDescProcedure, maxLength);

    const descriptionText = longDescProcedure.description || "";
    expect(result.text).toContain("DESC:");
    expect(result.text).toContain("..."); // Check for truncation indicator
    const descLine = result.text
      .split("\n")
      .find((line) => line.startsWith("DESC:"));
    expect(descLine).toBeDefined();
    // Check that the line is truncated (length < original) and close to maxLength (accounting for 'DESC: ' and '...')
    expect(descLine!.length).toBeLessThan(descriptionText.length);
    expect(descLine!.length).toBe(maxLength + "DESC: ".length); // Correct length check
  });
});
