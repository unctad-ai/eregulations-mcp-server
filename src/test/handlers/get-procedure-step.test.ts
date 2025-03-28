import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGetProcedureStepHandler } from '../../mcp-capabilities/tools/handlers/get-procedure-step.js';
import { ERegulationsApi } from '../../services/eregulations-api.js';
import { formatters } from '../../mcp-capabilities/tools/formatters/index.js';
import { ToolName } from '../../mcp-capabilities/tools/schemas.js';

// Mock dependencies
vi.mock('../../services/eregulations-api.js');
vi.mock('../../mcp-capabilities/tools/formatters/index.js', () => ({
  formatters: {
    step: {
      format: vi.fn()
    }
  }
}));

describe('GetProcedureStepHandler', () => {
  let mockApi: ERegulationsApi;
  let handler: ReturnType<typeof createGetProcedureStepHandler>;
  
  const mockProcedureId = 123;
  const mockStepId = 456;
  const mockStepData = {
    id: mockStepId,
    name: "Submit Application",
    description: "Fill out and submit the application form",
    requirements: [
      "Valid ID",
      "Proof of address"
    ],
    procedureId: mockProcedureId,
    stepNumber: 1,
    duration: "2-3 business days"
  };
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup mock API
    mockApi = {
      getProcedureStep: vi.fn().mockResolvedValue(mockStepData)
    } as unknown as ERegulationsApi;
    
    // Setup formatter mock
    const mockFormattedResult = {
      text: "Test formatted step details",
      data: { 
        id: mockStepId, 
        name: "Submit Application",
        requirements: ["Valid ID", "Proof of address"]
      }
    };
    vi.mocked(formatters.step.format).mockReturnValue(mockFormattedResult);
    
    // Create handler with mock API
    handler = createGetProcedureStepHandler(mockApi);
  });
  
  it('has the correct name and description', () => {
    expect(handler.name).toBe(ToolName.GET_PROCEDURE_STEP);
    expect(handler.description).toContain('Get information about a specific step');
    expect(handler.inputSchema).toBeDefined();
  });
  
  it('calls the API with the correct IDs and formats the result', async () => {
    // Call the handler with procedure ID and step ID
    const result = await handler.handler({ 
      procedureId: mockProcedureId,
      stepId: mockStepId 
    });
    
    // Verify API was called with the correct IDs
    expect(mockApi.getProcedureStep).toHaveBeenCalledWith(mockProcedureId, mockStepId);
    
    // Verify formatter was called with the API result
    expect(formatters.step.format).toHaveBeenCalledWith(mockStepData);
    
    // Verify the response structure
    expect(result.content).toHaveLength(2);
    expect(result.content[0]).toEqual({ 
      type: "text", 
      text: "Test formatted step details"
    });
    expect(result.content[1].type).toBe("text");
    expect(result.content[1].text).toContain("```json\n");
    expect(result.content[1].annotations).toEqual({ role: "data" });
  });
  
  it('handles API errors correctly', async () => {
    // Setup API to throw an error
    const testError = new Error('Step not found');
    vi.mocked(mockApi.getProcedureStep).mockRejectedValue(testError);
    
    // Call the handler
    const result = await handler.handler({ 
      procedureId: mockProcedureId,
      stepId: mockStepId 
    });
    
    // Verify the response contains the error message
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("Error retrieving step details: Step not found");
  });
  
  it('handles missing parameters gracefully', async () => {
    // Setup API to throw an error for missing parameters
    const testError = new Error('Missing required parameters');
    vi.mocked(mockApi.getProcedureStep).mockRejectedValue(testError);
    
    // Call the handler without providing IDs
    const result = await handler.handler({});
    
    // The API should be called with undefined parameters
    expect(mockApi.getProcedureStep).toHaveBeenCalledWith(undefined, undefined);
    
    // When the API throws an error due to missing parameters,
    // the handler should handle it and return an error message
    expect(result.content[0].text).toContain("Error retrieving step details");
  });
  
  it('handles non-Error exceptions correctly', async () => {
    // Setup API to throw a non-Error value
    vi.mocked(mockApi.getProcedureStep).mockRejectedValue('API connection failed');
    
    // Call the handler
    const result = await handler.handler({ 
      procedureId: mockProcedureId,
      stepId: mockStepId 
    });
    
    // Verify the response contains the string representation
    expect(result.content[0].text).toContain("Error retrieving step details: API connection failed");
  });
});