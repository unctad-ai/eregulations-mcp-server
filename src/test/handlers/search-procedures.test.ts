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

  const mockObjectives: ObjectiveData[] = [
    { id: 1, name: "Obj 1", description: "Desc 1" },
    { id: 2, name: "Obj 2" },
  ];
  const mockFormattedResult = {
    text: "Formatted text",
    data: [
      { id: 1, name: "Obj 1" },
      { id: 2, name: "Obj 2" },
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
      "Search for procedures by keyword or phrase"
    );
    expect(handler.inputSchema).toBeDefined(); // Assuming SearchProceduresSchema is imported/mocked correctly
  });

  it("should call api.searchProcedures and formatter.format with correct arguments", async () => {
    const args = { keyword: "test" };
    await handler.handler(args);

    expect(mockApi.searchProcedures).toHaveBeenCalledWith("test");
    expect(formatters.searchProcedures.format).toHaveBeenCalledWith(
      mockObjectives,
      "test",
      undefined,
      undefined
    );
  });

  it("should return formatted results in the content structure", async () => {
    const args = { keyword: "test" };
    const result = await handler.handler(args);

    expect(result).toEqual({
      content: [
        { type: "text", text: mockFormattedResult.text },
        {
          type: "text",
          text: `\`\`\`json\n${JSON.stringify(
            mockFormattedResult.data,
            null,
            2
          )}\n\`\`\``,
          annotations: { role: "data" },
        },
      ],
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
