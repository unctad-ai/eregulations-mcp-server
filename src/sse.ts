import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import { createServer } from "./mcp-server.js";
import { logger } from "./utils/logger.js";
import { v4 as uuidv4 } from "uuid";

// Default API URL
const API_URL = process.env.EREGULATIONS_API_URL || "https://api-tanzania.tradeportal.org";
const app = express();
const { server, cleanup } = createServer(API_URL);

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

// Helper to set SSE headers
const setSSEHeaders = (res: express.Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Cache-Control', 'no-cache');
  // Disable buffering for proxies
  res.setHeader('X-Accel-Buffering', 'no');
};

// SSE endpoint
app.get("/sse", async (req, res) => {
  const sessionId = req.query.sessionId?.toString() || uuidv4();
  logger.info(`Received SSE connection for session: ${sessionId}`);

  // Set headers for SSE
  setSSEHeaders(res);
  
  // Keep connection alive with a ping every 30 seconds
  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 30000);
  
  try {
    // Create a new transport
    const transport = new SSEServerTransport("/message", res);
    
    // Store the transport with the session ID
    transports.set(sessionId, transport);
    logger.info(`Created transport for session: ${sessionId}. Active sessions: ${transports.size}`);
    
    // Send the session ID to the client
    res.write(`data: ${JSON.stringify({ sessionId })}\n\n`);
    
    // Connect the server to this transport (this will call start() internally)
    await server.connect(transport);

    // Handle client disconnect
    req.on('close', () => {
      clearInterval(heartbeat);
      transports.delete(sessionId);
      logger.info(`Client disconnected: ${sessionId}. Remaining sessions: ${transports.size}`);
    });

    // Set up close handler
    server.onclose = async () => {
      logger.info(`Closing transport for session: ${sessionId}`);
      clearInterval(heartbeat);
      transports.delete(sessionId);
      await cleanup();
      await server.close();
      process.exit(0);
    };
    
  } catch (error) {
    clearInterval(heartbeat);
    transports.delete(sessionId);
    logger.error(`Error setting up SSE transport for session ${sessionId}:`, error);
    if (!res.headersSent) {
      res.status(500).end(`Error setting up SSE transport: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
});

// Message endpoint for client to post messages to the server
app.post("/message", async (req, res) => {
  // Get session ID from query parameter or header
  const sessionId = req.query.sessionId?.toString() || req.headers['x-session-id']?.toString();
  
  if (!sessionId) {
    logger.warn("No session ID provided");
    return res.status(400).json({ error: "No session ID provided" });
  }
  
  logger.info(`Received message from client for session: ${sessionId}`);
  
  const transport = transports.get(sessionId);
  if (!transport) {
    logger.warn(`No transport found for session ${sessionId}`);
    return res.status(404).json({ error: "No active connection for this session" });
  }
  
  try {
    await transport.handlePostMessage(req, res);
    logger.info(`Successfully handled post message for session: ${sessionId}`);
  } catch (error) {
    logger.error(`Error handling post message for session ${sessionId}:`, error);
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
    serverReady: !!server,
    uptime: process.uptime()
  };
  logger.info(`Health check: ${transports.size} active sessions`);
  res.status(200).json(status);
});

// Start the server
const PORT = process.env.PORT || 7000;
app.listen(PORT, () => {
  logger.info(`eRegulations MCP server running on port ${PORT}`);
  logger.info(`Connect via SSE at http://localhost:${PORT}/sse`);
});