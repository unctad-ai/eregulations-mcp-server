import { z } from "zod";

// Define a base content type
interface McpContent {
  type: string;
  [key: string]: any; // Allow other properties
}

export interface ToolHandler {
  name: string;
  description: string;
  inputSchema: any;
  inputSchemaDefinition: z.ZodTypeAny;
  handler: (args: any) => Promise<{
    content: McpContent[]; // Use the broader McpContent type
    _meta?: Record<string, any>; // Optionally allow _meta
    isError?: boolean; // Optionally allow isError
  }>;
}
