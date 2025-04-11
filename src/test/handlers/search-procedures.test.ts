import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSearchProceduresHandler } from "../../mcp-capabilities/tools/handlers/search-procedures.js";
import { ERegulationsApi } from "../../services/eregulations-api.js";
import { formatters } from "../../mcp-capabilities/tools/formatters/index.js";
import { ToolName } from "../../mcp-capabilities/tools/schemas.js";
import type { ObjectiveData } from "../../mcp-capabilities/tools/formatters/types.js";

// Mock dependencies
vi.mock("../../services/eregulations-api.js");
vi.mock("../../mcp-capabilities/tools/formatters/index.js");
vi.mock("../../utils/logger.js", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
}));

describe("createSearchProceduresHandler", () => {
  let mockApi: ERegulationsApi;
  let handler: ReturnType<typeof createSearchProceduresHandler>;

  // Updated mock data with links
  const mockObjectives: ObjectiveData[] = [
    {
      id: 1,
      name: "Procedure 1",
      description: "Desc 1",
      links: [{ rel: "procedure", href: "..." }], // This is a procedure
    },
    {
      id: 2,
      name: "Objective 2",
      description: "Desc 2",
      links: [{ rel: "objective", href: "..." }], // This is an objective
    },
    {
      id: 3,
      name: "Procedure 3",
      links: [{ rel: "procedure", href: "..." }], // This is a procedure, no description
    },
    {
      id: 4,
      name: "Item without links",
      description: "Desc 4",
    }, // No links, should be filtered out
    {
      id: 5,
      name: "Item with empty links",
      description: "Desc 5",
      links: [],
    }, // Empty links, should be filtered out
    {
      id: 6,
      name: "Item with null link",
      description: "Desc 6",
      links: [null],
    }, // Invalid link, should be filtered out
  ];

  // Expected filtered results for the formatter
  const expectedFilteredProcedures = [
    {
      id: 1,
      name: "Procedure 1",
      description: "Desc 1",
      links: [{ rel: "procedure", href: "..." }],
    },
    {
      id: 3,
      name: "Procedure 3",
      links: [{ rel: "procedure", href: "..." }],
    },
  ];

  const mockFormattedResult = {
    text: "Formatted text",
    data: [
      // Data returned by formatter might differ based on its logic,
      // but the handler only cares about the 'text' part.
      { id: 1, name: "Procedure 1" },
      { id: 3, name: "Procedure 3" },
    ],
  };

  beforeEach(() => {
    vi.resetAllMocks();

    // Mock ERegulationsApi methods
    mockApi = new ERegulationsApi();
    mockApi.searchProcedures = vi.fn().mockResolvedValue(mockObjectives);

    // Mock formatter
    formatters.searchProcedures.format = vi
      .fn()
      .mockReturnValue(mockFormattedResult);

    handler = createSearchProceduresHandler(mockApi);
  });

  it("should have correct name, description, and inputSchema", () => {
    expect(handler.name).toBe(ToolName.SEARCH_PROCEDURES);
    expect(handler.description).toBe(
      "Search for procedures by keyword or phrase. The search uses OR logic between words in the keyword phrase. For best results, prefer using a single, specific keyword whenever possible."
    );
    expect(handler.inputSchema).toBeDefined(); // Assuming SearchProceduresSchema is imported/mocked correctly
  });

  it("should call api.searchProcedures and formatter.format with correct arguments", async () => {
    const args = { keyword: "test" };
    await handler.handler(args);

    expect(mockApi.searchProcedures).toHaveBeenCalledWith("test");
    // Expect formatter to be called with the FILTERED procedures
    expect(formatters.searchProcedures.format).toHaveBeenCalledWith(
      expectedFilteredProcedures, // Use the expected filtered list
      "test",
      undefined,
      undefined
    );
  });

  it("should return formatted results in the content structure", async () => {
    const args = { keyword: "test" };
    const result = await handler.handler(args);

    expect(result).toEqual({
      content: [{ type: "text", text: mockFormattedResult.text }],
    });
  });

  it("should handle errors from api.searchProcedures", async () => {
    const error = new Error("API Error");
    mockApi.searchProcedures = vi.fn().mockRejectedValue(error);
    const args = { keyword: "fail" };

    const result = await handler.handler(args);

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: `Error searching for procedures: ${error.message}`,
        },
      ],
    });
  });

  it("should handle errors from formatter.format", async () => {
    const error = new Error("Formatter Error");
    formatters.searchProcedures.format = vi.fn().mockImplementation(() => {
      throw error;
    });
    const args = { keyword: "format-fail" };

    // The handler currently catches errors broadly, so this should also be caught
    const result = await handler.handler(args);

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: `Error searching for procedures: ${error.message}`,
        },
      ],
    });
  });
});
