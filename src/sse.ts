import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import { createServer } from "./mcp-server.js";
import { logger } from "./utils/logger.js";
import { v4 as uuidv4 } from "uuid";
import cors from "cors";

// Default API URL
const API_URL = process.env.EREGULATIONS_API_URL || "https://api-tanzania.tradeportal.org";
const PORT = process.env.PORT || 7000;
const app = express();
const { server, cleanup } = createServer(API_URL);

// Map to store sessions with their transports and responses
const sessions = new Map<string, { 
  transport: SSEServerTransport, 
  response: express.Response,
  heartbeat?: NodeJS.Timeout 
}>();

// Use cors middleware for handling CORS properly
app.use(cors());

// Configure additional CORS headers for SSE connections if needed
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Helper function to cleanly remove a session
const cleanupSession = (sessionId: string, reason?: string) => {
  if (sessions.has(sessionId)) {
    const session = sessions.get(sessionId);
    
    // Clear the heartbeat if it exists
    if (session?.heartbeat) {
      clearInterval(session.heartbeat);
    }
    
    sessions.delete(sessionId);
    logger.info(`Client session ended: ${sessionId}${reason ? ` (${reason})` : ''}. Remaining sessions: ${sessions.size}`);
  }
};

// Set up a global server close handler
server.onclose = async () => {
  logger.info(`Server shutting down, closing all active sessions...`);
  
  // Clean up all active sessions
  for (const [sessionId, session] of sessions.entries()) {
    if (session.heartbeat) {
      clearInterval(session.heartbeat);
    }
    sessions.delete(sessionId);
  }
  
  // Clean up server resources
  await cleanup();
  await server.close();
  
  logger.info(`All connections closed, server shutdown complete`);
};

// Handle process signals for graceful shutdown
const onSignals = () => {
  ['SIGINT', 'SIGTERM', 'SIGHUP'].forEach(signal => {
    process.on(signal, () => {
      logger.info(`${signal} received, initiating graceful shutdown`);
      server.onclose?.();
      process.exit(0);
    });
  });

  process.stdin.on('close', () => {
    logger.info('stdin closed. Initiating graceful shutdown');
    server.onclose?.();
    process.exit(0);
  });
};

// Initialize signal handlers
onSignals();

// Debug endpoint to see active connections
app.get("/debug/connections", (req, res) => {
  const activeConnections = Array.from(sessions.keys());
  res.json({
    activeConnections,
    count: activeConnections.length
  });
});

// SSE endpoint
app.get("/sse", async (req, res) => {
  // Use existing session ID if provided, otherwise create new one
  const sessionId = req.query.sessionId?.toString() || uuidv4();
  
  logger.info(`Received SSE connection for session: ${sessionId}`);

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  
  try {
    // Check if there's an existing transport for this session and clean it up
    if (sessions.has(sessionId)) {
      logger.info(`Cleaning up existing transport for session: ${sessionId}`);
      cleanupSession(sessionId, "reconnection");
    }
    
    // Create a new transport
    const transport = new SSEServerTransport("/message", res);
    
    // Set up a connection timeout
    const connectionTimeout = setTimeout(() => {
      logger.warn(`Connection timeout for session ${sessionId}`);
      cleanupSession(sessionId, "timeout");
      try {
        res.write(`data: ${JSON.stringify({ error: "Connection timeout" })}\n\n`);
        res.end();
      } catch (err) {
        logger.error(`Error sending timeout message: ${err}`);
      }
    }, 30000);
    
    // Connect the server to this transport
    await server.connect(transport);
    
    // Clear the connection timeout since we're connected
    clearTimeout(connectionTimeout);
    
    // Set up heartbeat
    const heartbeat = setInterval(() => {
      try {
        res.write(": heartbeat\n\n");
      } catch (err) {
        logger.error(`Heartbeat failed for session ${sessionId}: ${err}`);
        cleanupSession(sessionId, "failed heartbeat");
      }
    }, 30000);
    
    // Store transport and response
    sessions.set(sessionId, { transport, response: res, heartbeat });
    
    // Set up transport event handlers
    transport.onmessage = (msg) => {
      logger.info(`Message received from client (session ${sessionId}): ${JSON.stringify(msg)}`);
    };

    transport.onclose = () => {
      logger.info(`SSE connection closed (session ${sessionId})`);
      cleanupSession(sessionId);
    };

    transport.onerror = (err) => {
      logger.error(`SSE error (session ${sessionId}):`, err);
      cleanupSession(sessionId, "transport error");
    };
    
    logger.info(`Created transport for session: ${sessionId}. Active sessions: ${sessions.size}`);
    
    // Send the session ID to the client after transport is connected
    try {
      res.write(`data: ${JSON.stringify({ sessionId, status: "connected" })}\n\n`);
    } catch (err) {
      logger.error(`Failed to send initial data: ${err}`);
      cleanupSession(sessionId, "failed to send initial data");
      return;
    }
    
    // Handle client disconnect
    req.on('close', () => {
      cleanupSession(sessionId, "client closed connection");
    });
    
    req.on('error', (err) => {
      // Check if this is just a normal client disconnect
      const isClientDisconnect = 
        err.message === 'aborted' || 
        err.message.includes('aborted') ||
        err.message.includes('socket hang up');
      
      if (isClientDisconnect) {
        logger.info(`Client disconnected for session ${sessionId}`);
      } else {
        logger.error(`Error in SSE connection for session ${sessionId}: ${err}`);
      }
      
      cleanupSession(sessionId, isClientDisconnect ? "client disconnected" : "connection error");
    });
    
  } catch (error) {
    cleanupSession(sessionId, "connection error");
    
    logger.error(`Error setting up SSE transport for session ${sessionId}:`, error);
    if (!res.headersSent) {
      res.status(500).end(`Error setting up SSE transport: ${error instanceof Error ? error.message : String(error)}`);
    } else {
      // Try to end the response with an error message if headers are already sent
      try {
        res.write(`data: ${JSON.stringify({ error: "Connection error", message: String(error) })}\n\n`);
        res.end();
      } catch (writeError) {
        logger.error(`Failed to write error to response:`, writeError);
      }
    }
  }
});

// Message endpoint for client to post messages to the server
app.post("/message", async (req, res) => {
  // Get session ID from query parameter or header
  const sessionId = req.query.sessionId?.toString() || req.headers['x-session-id']?.toString();
  
  if (!sessionId) {
    logger.warn("No session ID provided for message");
    return res.status(400).json({ error: "No session ID provided" });
  }
  
  logger.info(`Received message from client for session: ${sessionId}`);
  
  const session = sessions.get(sessionId);
  if (!session || !session.transport) {
    logger.warn(`No active connection found for session ${sessionId}`);
    return res.status(404).json({ error: "No active connection for this session" });
  }
  
  try {
    await session.transport.handlePostMessage(req, res);
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
    activeSessions: sessions.size,
    serverReady: !!server,
    uptime: process.uptime()
  };
  logger.info(`Health check: ${sessions.size} active sessions`);
  res.status(200).json(status);
});

// Start the server
const httpServer = app.listen(PORT, () => {
  logger.info(`eRegulations MCP server running on port ${PORT}`);
  logger.info(`Connect via SSE at http://localhost:${PORT}/sse`);
});

// Add more graceful shutdown handling for the HTTP server
httpServer.on('close', () => {
  logger.info('HTTP server closed.');
});