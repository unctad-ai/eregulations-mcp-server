import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { ERegulationsApi } from "./services/eregulations-api.js";
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const api = new ERegulationsApi('https://api-tanzania.tradeportal.org');

const useSSE = process.env.TRANSPORT === 'sse';
console.log(`Using ${useSSE ? 'sse' : "stdio"} transport`);

// Define available test options
const availableTests = {
  "prompts": "Test the standard prompts functionality",
  "list-tools": "Test the tool listing functionality",
  "filters": "Test the filter-related tools",
  "list-procedures": "Test the listProcedures tool",
  "procedure-details": "Test the getProcedureDetails tool",
  "search-procedures": "Test the searchProcedures tool",
  "all": "Run all tests sequentially"
};

// Parse command line arguments to determine which tests to run
const args = process.argv.slice(2);
const testFilter = args.length > 0 ? args[0].toLowerCase() : '';

// If no arguments provided or help requested, display available options
if (!testFilter || testFilter === 'help' || testFilter === '-h' || testFilter === '--help') {
  console.log('\nAvailable test options:');
  
  const maxLength = Math.max(...Object.keys(availableTests).map(k => k.length));
  Object.entries(availableTests).forEach(([name, description]) => {
    console.log(`  ${name.padEnd(maxLength + 2)}${description}`);
  });
  
  console.log('\nUsage:');
  console.log('  node dist/test-client.js [test-name]\n');
  process.exit(0);
}

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
        tools: {},
        prompts: true // Enable standard prompts capability
      }
    }
  );
  
  let allPassed = true;
  
  try {
    console.log('Connecting to MCP server...');
    await client.connect(transport);
    console.log('Connected successfully!');
    
    // Define test functions for each feature
    const tests = {
      // Test prompts functionality
      "prompts": async () => {
        console.log('\n=== Testing Standard Prompts ===');
        try {
          // List available prompts
          const promptsResponse = await client.listPrompts();
          
          if (promptsResponse && promptsResponse.prompts) {
            console.log('Prompts received successfully!');
            console.log(`Found ${promptsResponse.prompts.length} prompts.`);
            
            // Display each prompt
            console.log('\nAvailable Prompts:');
            promptsResponse.prompts.forEach((prompt) => {
              console.log(`\n--- ${prompt.name} ---`);
              console.log(`Description: ${prompt.description}`);
              if (prompt.arguments && prompt.arguments.length) {
                console.log('Arguments:');
                prompt.arguments.forEach(arg => {
                  console.log(`  - ${arg.name}: ${arg.description} ${arg.required ? '(required)' : '(optional)'}`);
                });
              }
            });
            
            // Test getting a specific prompt
            if (promptsResponse.prompts.length > 0) {
              const firstPrompt = promptsResponse.prompts[0].name;
              console.log(`\nTesting getPrompt for "${firstPrompt}":`);
              
              const promptResult = await client.getPrompt({ 
                name: firstPrompt,
                arguments: {} 
              });
              
              if (promptResult && promptResult.messages) {
                console.log(`Successfully received prompt template with ${promptResult.messages.length} messages.`);
                console.log('First message preview:');
                const firstMsg = promptResult.messages[0];
                // Type-safe access to message content
                if (firstMsg.content && typeof firstMsg.content === 'object' && 'text' in firstMsg.content && typeof firstMsg.content.text === 'string') {
                  // Show first few lines
                  const previewLines = firstMsg.content.text.split('\n').slice(0, 5);
                  console.log(previewLines.join('\n') + '\n...');
                }
                return true;
              } else {
                console.log('No prompt content received or unexpected format.');
                return false;
              }
            }
            return true;
          } else {
            console.log('No prompts available or unexpected response format:', promptsResponse);
            return false;
          }
        } catch (error: any) {
          console.error('Error testing prompts:', error.message || error);
          return false;
        }
      },
      
      // Test listing tools
      "list-tools": async () => {
        console.log('\n=== Testing Tool Listing ===');
        try {
          const toolList = await client.listTools();
          console.log(`Found ${toolList.tools.length} tools:`);
          
          for (const tool of toolList.tools) {
            console.log(`- ${tool.name}: ${tool.description}`);
          }
          return true;
        } catch (error: any) {
          console.error('Error listing tools:', error.message || error);
          return false;
        }
      },
      
      // Test getFilters tool
      "filters": async () => {
        console.log('\n=== Testing Filter Tools ===');
        try {
          console.log('\nTesting getFilters:');
          const filtersResult = await client.callTool({
            name: "getFilters",
            arguments: {}
          });
          
          if (filtersResult.content && Array.isArray(filtersResult.content)) {
            filtersResult.content.forEach((item: any) => {
              if (item.type === 'text' && !item.text.startsWith('```')) {
                console.log('\n' + item.text);
              }
            });
          }
          
          // Test a single filter options
          console.log('\nTesting getFilterOptions:');
          const filterOptionsResult = await client.callTool({
            name: "getFilterOptions",
            arguments: {
              filterId: 3 // Type of operation filter
            }
          });
          
          if (filterOptionsResult.content && Array.isArray(filterOptionsResult.content)) {
            filterOptionsResult.content.forEach((item: any) => {
              if (item.type === 'text' && !item.text.startsWith('```')) {
                console.log('\n' + item.text);
              }
            });
          }
          return true;
        } catch (error: any) {
          console.error('Error testing filter tools:', error.message || error);
          return false;
        }
      },
      
      // Test listProcedures tool
      "list-procedures": async () => {
        console.log('\n=== Testing listProcedures Tool ===');
        try {
          const listResult = await client.callTool({
            name: "listProcedures",
            arguments: {}
          });
          
          console.log('\nProcedures Summary:');
          if (listResult.content && Array.isArray(listResult.content)) {
            // Print the text content (not the JSON)
            listResult.content.forEach((item: any) => {
              if (item.type === 'text' && !item.text.startsWith('```')) {
                // Limit output to first few lines for brevity
                const lines = item.text.split('\n');
                console.log(lines.slice(0, 10).join('\n') + '\n...');
              }
            });
          }
          return true;
        } catch (error: any) {
          console.error('Error calling listProcedures:', error.message || error);
          return false;
        }
      },
      
      // Test getProcedureDetails tool
      "procedure-details": async () => {
        console.log('\n=== Testing getProcedureDetails Tool ===');
        try {
          console.log('\nGetting details for procedure ID 725:');
          const detailsResult = await client.callTool({
            name: "getProcedureDetails",
            arguments: {
              procedureId: 725 // Using a valid procedure ID
            }
          });
          
          if (detailsResult.content && Array.isArray(detailsResult.content)) {
            // Print first 15 lines of the procedure details
            const textContent = detailsResult.content.find((item: any) => 
              item.type === 'text' && !item.text.startsWith('```')
            );
            
            if (textContent) {
              const lines = textContent.text.split('\n');
              console.log(lines.slice(0, 15).join('\n') + '\n...');
            }
          }
          return true;
        } catch (error: any) {
          console.error('Error calling getProcedureDetails:', error.message || error);
          return false;
        }
      },
      
      // Test searchProcedures tool
      "search-procedures": async () => {
        console.log('\n=== Testing searchProcedures Tool ===');
        try {
          console.log('\nSearching for "import":');
          const searchResult = await client.callTool({
            name: "searchProcedures",
            arguments: {
              query: "import"
            }
          });
          
          if (searchResult.content && Array.isArray(searchResult.content)) {
            // Print first few lines of results
            const textContent = searchResult.content.find((item: any) => 
              item.type === 'text' && !item.text.startsWith('```')
            );
            
            if (textContent) {
              const lines = textContent.text.split('\n');
              console.log(lines.slice(0, 10).join('\n') + '\n...');
            }
          }
          return true;
        } catch (error: any) {
          console.error('Error calling searchProcedures:', error.message || error);
          return false;
        }
      }
    };
    
    // Validate that the selected test exists
    if (testFilter !== 'all' && !Object.keys(tests).includes(testFilter)) {
      console.error(`Error: Test "${testFilter}" not found.`);
      console.log(`Available tests: ${Object.keys(tests).join(', ')}, all`);
      process.exit(1);
    }
    
    // Run the specified test or all tests
    const testResults = new Map<string, boolean>();
    
    if (testFilter === 'all') {
      console.log('Running all tests...');
      for (const [testName, testFn] of Object.entries(tests)) {
        testResults.set(testName, await testFn());
      }
    } else {
      // Run only the specified test
      console.log(`Running test: ${testFilter}`);
      const testFn = tests[testFilter as keyof typeof tests];
      testResults.set(testFilter, await testFn());
    }
    
    // Print test results summary
    console.log('\n=== Test Results Summary ===');
    allPassed = true;
    for (const [testName, result] of testResults.entries()) {
      console.log(`${testName}: ${result ? '✅ PASS' : '❌ FAIL'}`);
      if (!result) allPassed = false;
    }
    
    if (allPassed) {
      console.log('\nAll tests passed successfully! 🎉');
    } else {
      console.log('\nSome tests failed. Check the logs for details.');
    }
    
  } catch (error: any) {
    console.error('Connection failed:', error.message || error);
    allPassed = false;
  } finally {
    try {
      console.log('\nDisconnecting...');
      await client.close();
      console.log('Disconnected successfully');
    } catch (error: any) {
      console.error('Error during disconnect:', error.message || error);
      allPassed = false;
    }
    process.exit(allPassed ? 0 : 1);
  }
}

main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});