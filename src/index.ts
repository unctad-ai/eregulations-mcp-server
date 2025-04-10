#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./mcp-server.js";
import { logger } from "./utils/logger.js";
import events from "events";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ERegulationsApi } from "./services/eregulations-api.js";

// Increase default max listeners to prevent memory leak warnings
events.setMaxListeners(20);

export async function main(apiUrl?: string) {
  logger.info("Starting MCP server (Standard SDK Mode)...");

  const { server } = createServer(apiUrl);
  const transport = new StdioServerTransport();

  logger.info("Attempting to connect server to stdio transport...");
  await server.connect(transport);
  logger.info("Server connected successfully via stdio transport.");

  process.stdin.on("end", () => {
    logger.info("Standard input stream ended, attempting graceful shutdown...");
    server
      .close()
      .then(() => {
        logger.info("Server closed gracefully after stdin ended.");
        process.exit(0);
      })
      .catch((e) => {
        logger.error("Error closing server after stdin ended:", e);
        process.exit(1);
      });
  });

  ["SIGINT", "SIGTERM", "SIGQUIT"].forEach((signal) => {
    process.on(signal, () => {
      console.error(`Received ${signal}, attempting graceful shutdown...`);
      server
        .close()
        .then(() => {
          console.error("Server closed gracefully on signal.");
          process.exit(0);
        })
        .catch((e) => {
          console.error("Error closing server on signal:", e);
          process.exit(1);
        });
    });
  });

  logger.info("MCP server ready via standard SDK stdio transport.");
}

// In ES modules, we can use import.meta.url to detect if this is the main module
// This is equivalent to require.main === module in CommonJS
const isMainModule = import.meta.url.endsWith(process.argv[1]);

if (isMainModule) {
  const argv = yargs(hideBin(process.argv))
    .option("api-url", {
      type: "string",
      description:
        "eRegulations API URL (overrides EREGULATIONS_API_URL environment variable)",
      default: process.env.EREGULATIONS_API_URL,
    })
    .help()
    .parseSync();

  main(argv["api-url"]).catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
}
// When imported as a module (for testing), don't automatically run main()
// This allows test code to call main() with specific parameters
