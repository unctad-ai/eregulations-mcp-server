import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import { createServer } from "./mcp-server.js";

// Default API URL
const API_URL = process.env.EREGULATIONS_API_URL || "https://api-tanzania.tradeportal.org";

const app = express();
const { server } = createServer(API_URL);
let transport: SSEServerTransport;

// Configure CORS headers for SSE connections
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// SSE endpoint
app.get("/sse", async (req, res) => {
  console.log("Received SSE connection");
  transport = new SSEServerTransport("/message", res);
  await server.connect(transport);
  
  server.onclose = async () => {
    console.log("Server closed");
    process.exit(0);
  };
});

// Message endpoint for client to post messages to the server
app.post("/message", express.json(), async (req, res) => {
  console.log("Received message from client");
  await transport.handlePostMessage(req, res);
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`eRegulations MCP server running on port ${PORT}`);
  console.log(`Connect via SSE at http://localhost:${PORT}/sse`);
});