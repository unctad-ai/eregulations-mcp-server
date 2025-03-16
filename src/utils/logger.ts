/**
 * Logger utility to control output based on environment
 * This allows for controlling log output when using the MCP client in production environments
 */
export class Logger {
  private static instance: Logger;
  private isVerbose: boolean = false;
  private isDebug: boolean = false;
  
  private constructor() {
    // Check environment variables and/or other configuration
    this.isDebug = process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true';
    this.isVerbose = this.isDebug || process.env.LOG_LEVEL === 'verbose';
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
  
  public log(...args: any[]): void {
    if (this.isVerbose) {
      console.log(`[${this.getTimestamp()}]`, ...args);
    }
  }

  public info(...args: any[]): void {
    // Info always logs regardless of environment for critical operational information
    console.log(`[${this.getTimestamp()}][INFO]`, ...args);
  }
  
  public debug(...args: any[]): void {
    if (this.isDebug) {
      console.debug(`[${this.getTimestamp()}][DEBUG]`, ...args);
    }
  }
  
  public warn(...args: any[]): void {
    console.warn(`[${this.getTimestamp()}][WARN]`, ...args);
  }
  
  public error(...args: any[]): void {
    console.error(`[${this.getTimestamp()}][ERROR]`, ...args);
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