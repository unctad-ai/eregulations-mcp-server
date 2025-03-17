export interface ToolHandler {
  name: string;
  description: string;
  inputSchema: any;
  handler: (args: any) => Promise<{
    content: Array<{
      type: string;
      text: string;
      annotations?: {
        role?: string;
      };
    }>;
  }>;
}