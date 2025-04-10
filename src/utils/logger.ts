/**
 * Logger utility to control output based on environment
 * Uses a TCP socket for output to avoid interfering with stdout/stderr
 * which is necessary for clean MCP JSON-RPC communication
 */
// Direct import for the net module
import { Socket } from "node:net";

// Constants for TCP logging
const RECONNECT_INTERVAL = 2000;
const defaultPort = 8099;
const envPort = process.env.MCPS_LOGGER_PORT;
const TCP_PORT = envPort ? Number(envPort) : defaultPort;
const envHost = process.env.MCPS_LOGGER_HOST;
const TCP_HOST = envHost || "localhost";

export class Logger {
  private static instance: Logger;
  private isVerbose: boolean = false;
  private isDebug: boolean = false;
  private useSocket: boolean = false;

  // TCP socket related properties
  private socket: Socket | null = null;
  private connected: boolean = false;
  private messageQueue: Array<{ level: string; message: string }> = [];
  private reconnectTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.useSocket = process.env.ENABLE_SOCKET_LOGGING === "true";

    // Check environment variables and/or other configuration
    this.isDebug =
      process.env.NODE_ENV === "development" || process.env.DEBUG === "true";
    this.isVerbose = this.isDebug || process.env.LOG_LEVEL === "verbose";

    // In test environment, always disable socket
    if (process.env.NODE_ENV === "test" || process.env.VITEST) {
      this.useSocket = false;
    }

    if (this.useSocket) {
      // Connect to the TCP log server
      this.connectToServer();

      // Handle process exit
      process.on("exit", () => {
        this.cleanup();
      });

      ["SIGINT", "SIGTERM"].forEach((signal) => {
        process.on(signal as any, () => {
          this.cleanup();
        });
      });
    }
  }

  private cleanup(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      try {
        this.socket.end();
      } catch (err) {
        // Ignore errors on cleanup
      }
      this.socket = null;
    }
  }

  private connectToServer(): void {
    this.socket = new Socket();

    this.socket.connect(TCP_PORT, TCP_HOST, () => {
      this.connected = true;

      // Send any queued messages
      while (this.messageQueue.length > 0) {
        const msg = this.messageQueue.shift();
        if (msg) this.sendToServer(msg.level, msg.message);
      }
    });

    this.socket.on("error", (err: Error) => {
      this.connected = false;
      this.socket = null;

      if (err.message?.includes("ECONNREFUSED")) {
        // Log the connection refusal and disable socket logging permanently for this session
        try {
          process.stderr.write(
            `[${this.getTimestamp()}][ERROR] Failed to connect to log server (port ${TCP_PORT}). Disabling socket logging for this session. Start log server with 'npm run logs' for future sessions.\n`
          );
        } catch (e) {
          // Ignore stderr write errors
        }
        this.useSocket = false; // Disable future socket attempts
        // DO NOT schedule reconnect for ECONNREFUSED
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer); // Clear any pending reconnect timer
          this.reconnectTimer = null;
        }
      } else {
        // For other errors, attempt to reconnect if socket logging is still enabled
        if (this.useSocket) {
          // Clear any existing timer before setting a new one
          if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
          }
          this.reconnectTimer = setTimeout(
            () => this.connectToServer(),
            RECONNECT_INTERVAL
          );
        }
      }
    });

    this.socket.on("close", () => {
      this.connected = false;
      this.socket = null;
      // Only schedule reconnect if socket logging is still enabled
      if (this.useSocket) {
        // Clear any existing timer before setting a new one
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        this.reconnectTimer = setTimeout(
          () => this.connectToServer(),
          RECONNECT_INTERVAL
        );
      }
    });
  }

  private sendToServer(level: string, message: string): void {
    if (this.connected && this.socket) {
      try {
        this.socket.write(`${JSON.stringify({ level, message })}\n`);
      } catch (err) {
        // If socket write fails, queue the message and try to reconnect
        this.messageQueue.push({ level, message });
        this.connected = false;
        this.socket = null;
        this.reconnectTimer = setTimeout(
          () => this.connectToServer(),
          RECONNECT_INTERVAL
        );
      }
    } else {
      this.messageQueue.push({ level, message });
    }
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private getTimestamp(): string {
    return new Date().toISOString();
  }

  private formatMessage(...args: any[]): string {
    return args
      .map((arg) =>
        typeof arg === "object" ? JSON.stringify(arg) : String(arg)
      )
      .join(" ");
  }

  public log(...args: any[]): void {
    if (this.isVerbose) {
      if (this.useSocket) {
        this.sendToServer("info", this.formatMessage(...args));
      } else {
        // Fall back to stderr
        process.stderr.write(
          `[${this.getTimestamp()}] ${this.formatMessage(...args)}\n`
        );
      }
    }
  }

  public info(...args: any[]): void {
    // Info always logs regardless of environment for critical operational information
    if (this.useSocket) {
      this.sendToServer("info", this.formatMessage(...args));
    } else {
      // Fall back to stderr
      process.stderr.write(
        `[${this.getTimestamp()}][INFO] ${this.formatMessage(...args)}\n`
      );
    }
  }

  public debug(...args: any[]): void {
    if (this.isDebug) {
      if (this.useSocket) {
        this.sendToServer("debug", this.formatMessage(...args));
      } else {
        // Fall back to stderr
        process.stderr.write(
          `[${this.getTimestamp()}][DEBUG] ${this.formatMessage(...args)}\n`
        );
      }
    }
  }

  public warn(...args: any[]): void {
    if (this.useSocket) {
      this.sendToServer("warn", this.formatMessage(...args));
    } else {
      // Fall back to stderr
      process.stderr.write(
        `[${this.getTimestamp()}][WARN] ${this.formatMessage(...args)}\n`
      );
    }
  }

  public error(...args: any[]): void {
    if (this.useSocket) {
      this.sendToServer("error", this.formatMessage(...args));
    } else {
      // Fall back to stderr
      process.stderr.write(
        `[${this.getTimestamp()}][ERROR] ${this.formatMessage(...args)}\n`
      );
    }
  }

  public setVerbose(isVerbose: boolean): void {
    this.isVerbose = isVerbose;
  }

  public setDebug(isDebug: boolean): void {
    this.isDebug = isDebug;
  }
}

// Create a default logger instance for easy import
export const logger = Logger.getInstance();
