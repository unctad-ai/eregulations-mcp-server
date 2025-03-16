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

  it('should search by text query', async () => {
    const result = await client.callTool({
      name: "searchProcedures",
      arguments: {
        query: "import"
      }
    });
    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);
  });

  it('should handle empty search query', async () => {
    const result = await client.callTool({
      name: "searchProcedures",
      arguments: {
        query: ""
      }
    });
    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);
  });
});