#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./mcp-server.js";
import { logger } from './utils/logger.js';
import events from 'events';

// Increase default max listeners to prevent memory leak warnings
events.setMaxListeners(20);

// Export the main function for testing
export async function main() {
  logger.info("Starting MCP server...");
    
  const transport = new StdioServerTransport();
  const { server, cleanup } = createServer();
  
  await server.connect(transport);
  
  // Handle termination signals
  ['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach(signal => {
    process.on(signal, async () => {
      logger.log(`Received ${signal}, shutting down...`);
      await cleanup();
      await server.close();
      process.exit(0);
    });
  });
}

  main().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
  });