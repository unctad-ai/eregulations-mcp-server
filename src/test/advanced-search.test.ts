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

  it('should search by type of operation', async () => {
    const result = await client.callTool({
      name: "searchProcedures",
      arguments: {
        filters: [
          { filterId: 3, filterOptionId: 3 }  // Type of operation = Export
        ]
      }
    });
    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);
  });

  it('should search by type of product', async () => {
    const result = await client.callTool({
      name: "searchProcedures",
      arguments: {
        filters: [
          { filterId: 4, filterOptionId: 1 }  // Type of product (first option)
        ]
      }
    });
    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);
  });

  it('should combine text search with filters', async () => {
    const result = await client.callTool({
      name: "searchProcedures",
      arguments: {
        query: "import",
        filters: [
          { filterId: 3, filterOptionId: 4 }  // Type of operation = Import
        ]
      }
    });
    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);
  });

  it('should handle multiple filters', async () => {
    const result = await client.callTool({
      name: "searchProcedures",
      arguments: {
        filters: [
          { filterId: 3, filterOptionId: 3 },  // Type of operation = Export
          { filterId: 4, filterOptionId: 1 }   // First product type
        ]
      }
    });
    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);
  });
});