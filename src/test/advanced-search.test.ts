import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Advanced Search Tests', () => {
  let client: Client;

  beforeEach(async () => {
    const transport = new StdioClientTransport({
      command: "node",
      args: [path.join(__dirname, "../dist/index.js")]
    });

    client = new Client(
      { name: "eregulations-test-client", version: "1.0.0" },
      { capabilities: { tools: {} } }
    );

    await client.connect(transport);
  });

  afterEach(async () => {
    await client.close();
  });

  it('should search by category and subcategory', async () => {
    const result = await client.callTool({
      name: "searchProcedures",
      arguments: {
        query: "trade",
        filters: [
          { key: 1, value: "TRADE" },          // Category filter
          { key: 2, value: ["EXPORT", "IMPORT"] }  // Sub-categories
        ]
      }
    });
    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);
  });

  it('should search by processing time and cost range', async () => {
    const result = await client.callTool({
      name: "searchProcedures",
      arguments: {
        filters: [
          { key: 3, value: { lte: 30 } },     // Processing time <= 30 days
          { key: 4, value: { gte: 100 } }     // Cost >= 100
        ]
      }
    });
    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);
  });

  it('should search by executing agency and status', async () => {
    const result = await client.callTool({
      name: "searchProcedures",
      arguments: {
        filters: [
          { key: 5, value: ["Customs", "Ministry of Trade"] },  // Executing agencies
          { key: 6, value: "ACTIVE" }                          // Status
        ]
      }
    });
    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);
  });

  it('should search by date range', async () => {
    const result = await client.callTool({
      name: "searchProcedures",
      arguments: {
        filters: [
          { 
            key: 7, 
            value: {
              gte: '2023-01-01',
              lte: '2023-12-31'
            }
          }
        ]
      }
    });
    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);
  });

  it('should combine multiple filter types', async () => {
    const result = await client.callTool({
      name: "searchProcedures",
      arguments: {
        query: "import",
        filters: [
          { key: 1, value: "TRADE" },                          // Category
          { key: 2, value: ["IMPORT"] },                       // Sub-category
          { key: 3, value: { lte: 30 } },                      // Processing time
          { key: 4, value: { gte: 100 } },                     // Cost
          { key: 5, value: ["Customs"] },                      // Executing agency
          { key: 6, value: "ACTIVE" },                         // Status
          { 
            key: 7,                                            // Date range
            value: {
              gte: '2023-01-01',
              lte: '2023-12-31'
            }
          }
        ]
      }
    });
    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);
  });
});