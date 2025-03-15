#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./mcp-server.js";

// Default API URL
const API_URL = process.env.EREGULATIONS_API_URL || "https://api-tanzania.tradeportal.org";

async function main() {
  const transport = new StdioServerTransport();
  const { server } = createServer(API_URL);
  
  await server.connect(transport);
  
  // Cleanup on exit
  process.on("SIGINT", async () => {
    await server.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});