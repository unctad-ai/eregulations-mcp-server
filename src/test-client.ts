import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const useSSE = process.env.TRANSPORT === 'sse';
console.log(`Using ${useSSE ? 'sse' : "stdio"} transport`);

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
      
      // Add debug logging for the raw data
      console.log('\n=== Raw API Response ===');
      if (listResult.content && Array.isArray(listResult.content)) {
        const jsonContent = listResult.content.find(item => item.text.startsWith('```json'));
        if (jsonContent) {
          const procedures = JSON.parse(jsonContent.text.replace(/```json\n|\n```/g, ''));
          console.log('Raw procedures structure:', JSON.stringify(procedures[0], null, 2));
          console.log('Total procedures:', procedures.length);
          if (procedures[0]?.childs) {
            console.log('Number of child procedures:', procedures[0].childs.length);
          }
        }
      }
      
      console.log('\n=== Formatted Procedures List ===');
      if (listResult.content && Array.isArray(listResult.content)) {
        listResult.content.forEach((item: any) => {
          if (item.type === 'text' && !item.text.startsWith('```')) {
            console.log('\n' + item.text);
          }
        });
      }
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
    
    console.log('\nTesting getProcedureDetails tool with a valid ID (725):');
    try {
      console.log('Making API request for procedure 725...');
      const detailsResult = await client.callTool({
        name: "getProcedureDetails",
        arguments: {
          procedureId: 725 // Using a valid procedure ID that we know exists
        }
      });
      
      console.log('API response:', JSON.stringify(detailsResult, null, 2));
      
      if (detailsResult.content && Array.isArray(detailsResult.content)) {
        detailsResult.content.forEach((item: any) => {
          if (item.type === 'text' && !item.text.startsWith('```')) {
            console.log('\n' + item.text);
          }
        });
      }
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
    
    // Test getProcedureStep tool with a valid step from procedure 725
    console.log('\nTesting getProcedureStep tool:');
    try {
      console.log('Making API request for step 2787 in procedure 725...');
      const stepResult = await client.callTool({
        name: "getProcedureStep",
        arguments: {
          procedureId: 725,
          stepId: 2787 // This is the first step "Submit application for buying cloves" from our previous test
        }
      });
      
      console.log('API response:', JSON.stringify(stepResult, null, 2));
      
      if (stepResult.content && Array.isArray(stepResult.content)) {
        stepResult.content.forEach((item: any) => {
          if (item.type === 'text' && !item.text.startsWith('```')) {
            console.log('\n' + item.text);
          }
        });
      }
    } catch (error: any) {
      console.error('Error calling getProcedureStep:', error.message || error);
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