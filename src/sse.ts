import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import { createServer } from "./mcp-server.js";
import { logger } from "./utils/logger.js";

// Default API URL
const API_URL = process.env.EREGULATIONS_API_URL || "https://api-tanzania.tradeportal.org";
const app = express();
const { server } = createServer(API_URL);

// Map to store transports by session ID
const transports = new Map<string, SSEServerTransport>();

// Configure CORS headers for SSE connections
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// SSE endpoint
app.get("/sse", async (req, res) => {
  logger.log("Received SSE connection");
  
  try {
    // Create a new transport
    const transport = new SSEServerTransport("/message", res);
    
    // Connect the server to this transport (this will call start() internally)
    await server.connect(transport);
    
    // Store the transport using its session ID
    const sessionId = transport.sessionId;
    transports.set(sessionId, transport);
    logger.log(`Created transport with session ID: ${sessionId}`);
    logger.log("Connected to transport successfully");
    
    // Set up error handler
    transport.onerror = (error) => {
      logger.error("Transport error:", error);
    };
    
    // Set up close handler
    transport.onclose = () => {
      logger.log(`Closing transport for session ${sessionId}`);
      transports.delete(sessionId);
    };
    
    // Handle connection close
    req.on('close', () => {
      logger.log(`SSE connection closed for session ${sessionId}`);
      transport.close().catch((err) => logger.error("Error closing transport:", err));
      transports.delete(sessionId);
    });
  } catch (error) {
    logger.error("Error setting up SSE transport:", error);
    if (!res.headersSent) {
      res.status(500).end("Error setting up SSE transport");
    }
  }
});

// Message endpoint for client to post messages to the server
app.post("/message", express.json(), async (req, res) => {
  logger.log("Received message from client");
  
  // Get session ID from query parameter or header
  const sessionId = req.query.sessionId?.toString() || req.headers['x-session-id']?.toString();
  
  if (!sessionId) {
    logger.log("No session ID provided");
    return res.status(400).json({ error: "No session ID provided" });
  }
  
  const transport = transports.get(sessionId);
  if (!transport) {
    logger.log(`No transport found for session ${sessionId}`);
    return res.status(404).json({ error: "No active connection for this session" });
  }
  
  try {
    await transport.handlePostMessage(req, res);
    logger.log("Successfully handled post message");
  } catch (error) {
    logger.error("Error handling post message:", error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: "Error handling message", 
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  const status = {
    status: "ok",
    activeSessions: transports.size,
    serverReady: !!server
  };
  res.status(200).json(status);
});

// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  logger.log(`eRegulations MCP server running on port ${PORT}`);
  logger.log(`Connect via SSE at http://localhost:${PORT}/sse`);
});