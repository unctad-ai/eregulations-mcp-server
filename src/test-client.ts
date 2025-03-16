import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const useSSE = process.env.TRANSPORT === 'sse';

async function main() {
  console.log('Starting eRegulations MCP test client...');
  
  let transport;
  
  if (useSSE) {
    console.log('Using SSE transport to connect to running MCP server');
    // Use URL object for SSEClientTransport as required by the SDK
    transport = new SSEClientTransport(new URL("http://localhost:3001/sse"));
  } else {
    console.log('Launching MCP server with stdio transport');
    transport = new StdioClientTransport({
      command: "node",
      args: [path.join(__dirname, "../dist/index.js")]
    });
  }
  
  const client = new Client(
    {
      name: "eregulations-test-client",
      version: "1.0.0"
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );
  
  try {
    console.log('Connecting to MCP server...');
    await client.connect(transport);
    console.log('Connected successfully!');
    
    // List available tools
    console.log('\nListing available tools:');
    const toolList = await client.listTools();
    console.log(`Found ${toolList.tools.length} tools:`);
    
    for (const tool of toolList.tools) {
      console.log(`- ${tool.name}: ${tool.description}`);
    }
    
    // Test listProcedures tool
    console.log('\nTesting listProcedures tool:');
    try {
      const listResult = await client.callTool({
        name: "listProcedures",
        arguments: {}
      });
      
      console.log('Response type:', typeof listResult);
      console.log('Response structure:', Object.keys(listResult));
      if (listResult.content && Array.isArray(listResult.content)) {
        console.log('Content types:', listResult.content.map((item: any) => item.type));
      }
      console.log('First part of response:', JSON.stringify(listResult).slice(0, 150) + '...');
    } catch (error: any) {
      console.error('Error calling listProcedures:', error.message || error);
    }
    
    // Test getProcedureDetails tool
    console.log('\nTesting getProcedureDetails tool:');
    try {
      const detailsResult = await client.callTool({
        name: "getProcedureDetails",
        arguments: {
          procedureId: 1
        }
      });
      
      console.log('Response type:', typeof detailsResult);
      console.log('Response structure:', Object.keys(detailsResult));
      if (detailsResult.content && Array.isArray(detailsResult.content)) {
        console.log('Content types:', detailsResult.content.map((item: any) => item.type));
      }
      console.log('First part of response:', JSON.stringify(detailsResult).slice(0, 150) + '...');
    } catch (error: any) {
      console.error('Error calling getProcedureDetails:', error.message || error);
    }
    
    // Test searchProcedures tool
    console.log('\nTesting searchProcedures tool:');
    try {
      const searchResult = await client.callTool({
        name: "searchProcedures",
        arguments: {
          query: "import"
        }
      });
      
      console.log('Response type:', typeof searchResult);
      console.log('Response structure:', Object.keys(searchResult));
      if (searchResult.content && Array.isArray(searchResult.content)) {
        console.log('Content types:', searchResult.content.map((item: any) => item.type));
      }
      console.log('First part of response:', JSON.stringify(searchResult).slice(0, 150) + '...');
    } catch (error: any) {
      console.error('Error calling searchProcedures:', error.message || error);
    }
    
  } catch (error: any) {
    console.error('Connection failed:', error.message || error);
  } finally {
    try {
      console.log('\nDisconnecting...');
      // Use close() instead of disconnect()
      await client.close();
      console.log('Disconnected successfully');
    } catch (error: any) {
      console.error('Error during disconnect:', error.message || error);
    }
    process.exit(0);
  }
}

main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});