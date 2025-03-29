#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./mcp-server.js";
import { logger } from './utils/logger.js';
import events from 'events';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

// Increase default max listeners to prevent memory leak warnings
events.setMaxListeners(20);

// Export the main function for testing
export async function main(apiUrl?: string) {
  logger.info("Starting MCP server...");
    
  const transport = new StdioServerTransport();
  const { server, cleanup } = createServer(apiUrl);
  
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

// In ES modules, we can use import.meta.url to detect if this is the main module
// This is equivalent to require.main === module in CommonJS
const isMainModule = import.meta.url.endsWith(process.argv[1]);

if (isMainModule) {
  const argv = yargs(hideBin(process.argv))
    .option('api-url', {
      type: 'string',
      description: 'eRegulations API URL (overrides EREGULATIONS_API_URL environment variable)',
      default: process.env.EREGULATIONS_API_URL
    })
    .help()
    .parseSync();

  main(argv['api-url']).catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
}
// When imported as a module (for testing), don't automatically run main()
// This allows test code to call main() with specific parameters