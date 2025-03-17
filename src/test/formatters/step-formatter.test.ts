import { describe, it, expect } from 'vitest';
import { StepFormatter } from '../../mcp-capabilities/tools/formatters/step-formatter.js';
import { StepData } from '../../mcp-capabilities/tools/formatters/types.js';

describe('StepFormatter', () => {
  const formatter = new StepFormatter();

  const mockStep: StepData = {
    id: 1,
    name: "Submit Application Documents",
    procedureId: 123,
    procedureName: "Import License Application",
    isOptional: false,
    isCertified: true,
    isParallel: false,
    isOnline: true,
    online: {
      url: "https://submit.example.com"
    },
    contact: {
      entityInCharge: {
        name: "Trade Authority",
        firstPhone: "123-456-7890",
        firstEmail: "trade@example.com",
        firstWebsite: "https://trade.example.com",
        address: "123 Trade Street",
        scheduleComments: "Mon-Fri, 9am-5pm"
      },
      unitInCharge: {
        name: "Import License Unit"
      },
      personInCharge: {
        name: "John Smith",
        profession: "License Officer"
      }
    },
    requirements: [
      {
        name: "Business Registration Certificate",
        comments: "Must be original",
        nbOriginal: 1,
        nbCopy: 2,
        nbAuthenticated: 1
      },
      {
        name: "Import Declaration Form",
        comments: "Fully completed",
        nbOriginal: 1
      }
    ],
    results: [
      {
        name: "Application Receipt",
        comments: "Keep safe",
        isFinalResult: false
      },
      {
        name: "Import License",
        comments: "Valid for 1 year",
        isFinalResult: true
      }
    ],
    timeframe: {
      timeSpentAtTheCounter: {
        minutes: { max: 30 }
      },
      waitingTimeInLine: {
        minutes: { max: 45 }
      },
      waitingTimeUntilNextStep: {
        days: { max: 5 }
      },
      comments: "Processing may take longer during peak seasons"
    },
    costs: [
      {
        value: 100,
        unit: "TZS",
        operator: "fixed",
        comments: "Application Fee",
        paymentDetails: "Pay at counter"
      },
      {
        value: 2,
        unit: "USD",
        operator: "percentage",
        parameter: "of import value",
        comments: "License Fee"
      }
    ],
    laws: [
      { name: "Import Control Act 2020" },
      { name: "Trade Regulations 2021" }
    ],
    additionalInfo: {
      text: "Bring valid ID for verification"
    }
  };

  it('formats step with all fields present', () => {
    const result = formatter.format(mockStep);
    
    // Verify text format is optimized for context
    expect(result.text).toContain('STEP: Submit Application Documents (ID:1)');
    expect(result.text).toContain('PROCEDURE: Import License Application (ID:123)');
    expect(result.text).toContain('ONLINE: Yes (https://submit.example.com)');
    expect(result.text).toContain('STATUS: Certified');
    
    // Check contact information formatting
    expect(result.text).toContain('Entity: Trade Authority');
    expect(result.text).toContain('Phone: 123-456-7890 | Email: trade@example.com | Web: https://trade.example.com');
    
    // Verify essential data is extracted
    expect(result.data).toEqual({
      id: 1,
      name: "Submit Application Documents",
      procedureId: 123,
      isOnline: true,
      entityName: "Trade Authority",
      onlineUrl: "https://submit.example.com",
      requirementCount: 2,
      requirements: ["Business Registration Certificate", "Import Declaration Form"],
      costCount: 2,
      hasCosts: true
    });
  });

  it('handles missing fields gracefully', () => {
    const minimalStep: StepData = {
      id: 2,
      name: "Basic Step"
    };

    const result = formatter.format(minimalStep);
    
    // Should not throw errors for missing fields
    expect(result.text).toContain('STEP: Basic Step (ID:2)');
    expect(result.data).toEqual({
      id: 2,
      name: "Basic Step",
      isOnline: false
    });
  });

  it('handles null/undefined step', () => {
    const resultNull = formatter.format(null as any);
    expect(resultNull.text).toBe('No step data available');
    expect(resultNull.data).toEqual({});

    const resultUndefined = formatter.format(undefined as any);
    expect(resultUndefined.text).toBe('No step data available');
    expect(resultUndefined.data).toEqual({});
  });

  it('formats timeframes efficiently', () => {
    const stepWithTimeframe: StepData = {
      id: 3,
      name: "Timeframe Test",
      timeframe: {
        timeSpentAtTheCounter: { minutes: { max: 30 } },
        waitingTimeInLine: { minutes: { max: 45 } },
        waitingTimeUntilNextStep: { days: { max: 5 } }
      }
    };

    const result = formatter.format(stepWithTimeframe);
    expect(result.text).toContain('30min at counter + 45min wait + 5 days processing');
  });

  it('formats costs efficiently', () => {
    const stepWithCosts: StepData = {
      id: 4,
      name: "Cost Test",
      costs: [
        {
          value: 100,
          unit: "TZS",
          comments: "Fixed Fee"
        },
        {
          value: 2,
          unit: "%",
          operator: "percentage",
          parameter: "of value",
          comments: "Variable Fee"
        }
      ]
    };

    const result = formatter.format(stepWithCosts);
    expect(result.text).toContain('COSTS:');
    expect(result.text).toContain('- 100 TZS (Fixed Fee)');
    expect(result.text).toContain('- 2% of value (Variable Fee)');
  });
});