import { describe, it, expect, vi, beforeEach } from "vitest";
import { createGetProcedureDetailsHandler } from "../../mcp-capabilities/tools/handlers/get-procedure-details.js";
import { ERegulationsApi } from "../../services/eregulations-api.js";
import { formatters } from "../../mcp-capabilities/tools/formatters/index.js";
import { logger } from "../../utils/logger.js";
import { ToolName } from "../../mcp-capabilities/tools/schemas.js";

// Mock dependencies
vi.mock("../../services/eregulations-api.js");
vi.mock("../../mcp-capabilities/tools/formatters/index.js", () => ({
  formatters: {
    procedure: {
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

describe("GetProcedureDetailsHandler", () => {
  let mockApi: ERegulationsApi;
  let handler: ReturnType<typeof createGetProcedureDetailsHandler>;

  const mockProcedureId = 123;
  const mockProcedure = {
    id: mockProcedureId,
    name: "Import License",
    fullName: "Apply for Import License",
    explanatoryText: "Process for obtaining an import license",
    isOnline: true,
    steps: [
      { id: 1, name: "Submit application" },
      { id: 2, name: "Pay fees" },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock API
    mockApi = {
      getProcedureById: vi.fn().mockResolvedValue(mockProcedure),
    } as unknown as ERegulationsApi;

    // Setup formatter mock
    const mockFormattedResult = {
      text: "Test formatted procedure details",
      data: { id: mockProcedureId, name: "Test Procedure", steps: [] },
    };
    vi.mocked(formatters.procedure.format).mockReturnValue(mockFormattedResult);

    // Create handler with mock API
    handler = createGetProcedureDetailsHandler(mockApi);
  });

  it("has the correct name and description", () => {
    expect(handler.name).toBe(ToolName.GET_PROCEDURE_DETAILS);
    expect(handler.description).toContain(
      "Get detailed information about a specific procedure"
    );
    expect(handler.inputSchema).toBeDefined();
  });

  it("calls the API with the correct procedure ID and formats the result", async () => {
    // Call the handler with procedure ID
    const result = await handler.handler({ procedureId: mockProcedureId });

    // Verify API was called with the correct ID
    expect(mockApi.getProcedureById).toHaveBeenCalledWith(mockProcedureId);

    // Verify formatter was called with the API result and undefined for maxLength
    expect(formatters.procedure.format).toHaveBeenCalledWith(
      mockProcedure,
      undefined
    );

    // Verify the response structure
    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toEqual({
      type: "text",
      text: "Test formatted procedure details",
    });

    // Verify logging
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining(
        `Handling GET_PROCEDURE_DETAILS request for ID ${mockProcedureId}`
      )
    );
    expect(logger.log).not.toHaveBeenCalledWith(
      expect.stringContaining(`max_length:`)
    ); // Ensure max_length wasn't logged when not provided
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining(
        `GET_PROCEDURE_DETAILS returning details for ${mockProcedure.name}`
      )
    );
  });

  it("handles API errors correctly", async () => {
    // Setup API to throw an error
    const testError = new Error("Procedure not found");
    vi.mocked(mockApi.getProcedureById).mockRejectedValue(testError);

    // Call the handler
    const result = await handler.handler({ procedureId: mockProcedureId });

    // Verify error handling
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        `Error in GET_PROCEDURE_DETAILS handler for ID ${mockProcedureId}`
      ),
      testError.message
    );

    // Verify the response contains the error message and suggestion
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain(
      "Error retrieving procedure details: Procedure not found"
    );
    expect(result.content[0].text).toContain(
      "Valid procedure IDs can be found by using the listProcedures tool"
    );
  });

  it("handles missing procedureId parameter gracefully", async () => {
    // Setup API to throw an error for missing ID
    const testError = new Error("Missing required parameter: procedureId");
    vi.mocked(mockApi.getProcedureById).mockRejectedValue(testError);

    // Call the handler without providing a procedure ID
    const result = await handler.handler({});

    // The API should be called with undefined
    expect(mockApi.getProcedureById).toHaveBeenCalledWith(undefined);

    // Verify error logging
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        `Error in GET_PROCEDURE_DETAILS handler for ID undefined`
      ),
      testError.message
    );

    // Verify the response contains a helpful error message
    expect(result.content[0].text).toContain(
      "Error retrieving procedure details"
    );
  });

  it("handles non-Error exceptions correctly", async () => {
    // Setup API to throw a non-Error value
    vi.mocked(mockApi.getProcedureById).mockRejectedValue(
      "API connection failed"
    );

    // Call the handler
    const result = await handler.handler({ procedureId: mockProcedureId });

    // Verify error handling for string error
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        `Error in GET_PROCEDURE_DETAILS handler for ID ${mockProcedureId}`
      ),
      "API connection failed"
    );

    // Verify the response contains the string representation
    expect(result.content[0].text).toContain(
      "Error retrieving procedure details: API connection failed"
    );
  });
});
