import { describe, it, expect, vi, beforeEach } from "vitest";
import { createListProceduresHandler } from "../../mcp-capabilities/tools/handlers/list-procedures.js";
import { ERegulationsApi } from "../../services/eregulations-api.js";
import { formatters } from "../../mcp-capabilities/tools/formatters/index.js";
import { logger } from "../../utils/logger.js";
import { ToolName } from "../../mcp-capabilities/tools/schemas.js";

// Mock dependencies
vi.mock("../../services/eregulations-api.js");
vi.mock("../../mcp-capabilities/tools/formatters/index.js", () => ({
  formatters: {
    procedureList: {
      format: vi.fn(),
    },
  },
}));
vi.mock("../../utils/logger.js", () => ({
  logger: {
    log: vi.fn(),
    error: vi.fn(),
  },
}));

describe("ListProceduresHandler", () => {
  let mockApi: ERegulationsApi;
  let handler: ReturnType<typeof createListProceduresHandler>;

  const mockProcedures = [
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
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock API
    mockApi = {
      getProceduresList: vi.fn().mockResolvedValue(mockProcedures),
    } as unknown as ERegulationsApi;

    // Setup formatter mock
    const mockFormattedResult = {
      text: "Test formatted procedures list",
      data: [{ id: 1, name: "Test" }],
    };
    vi.mocked(formatters.procedureList.format).mockReturnValue(
      mockFormattedResult
    );

    // Create handler with mock API
    handler = createListProceduresHandler(mockApi);
  });

  it("has the correct name and description", () => {
    expect(handler.name).toBe(ToolName.LIST_PROCEDURES);
    expect(handler.description).toContain("List all available procedures");
    expect(handler.inputSchema).toBeDefined();
  });

  it("calls the API and formats the result correctly", async () => {
    // Call the handler with default args
    const result = await handler.handler({});

    // Verify API was called
    expect(mockApi.getProceduresList).toHaveBeenCalledTimes(1);

    // Verify formatter was called with the API result and default args
    expect(formatters.procedureList.format).toHaveBeenCalledWith(
      mockProcedures,
      false,
      undefined,
      undefined
    );

    // Verify the response structure
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "Test formatted procedures list",
        },
      ],
    });

    // Verify logging
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining("Handling LIST_PROCEDURES request")
    );
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining("returning 2 procedures")
    );
  });

  it("handles API errors correctly", async () => {
    // Setup API to throw an error
    const testError = new Error("Test API error");
    vi.mocked(mockApi.getProceduresList).mockRejectedValue(testError);

    // Call the handler with default args
    const result = await handler.handler({});

    // Verify error handling
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Error in LIST_PROCEDURES handler:"),
      testError
    );

    // Verify the response contains the error message
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain(
      "Error retrieving procedures: Test API error"
    );
  });

  it("handles non-Error exceptions correctly", async () => {
    // Setup API to throw a non-Error value
    vi.mocked(mockApi.getProceduresList).mockRejectedValue(
      "Non-error rejection"
    );

    // Call the handler with default args
    const result = await handler.handler({});

    // Verify error handling
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Error in LIST_PROCEDURES handler:"),
      "Non-error rejection"
    );

    // Verify the response contains the string representation
    expect(result.content[0].text).toContain(
      "Error retrieving procedures: Non-error rejection"
    );
  });
});
