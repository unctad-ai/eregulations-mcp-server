import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log("Using stdio transport");

// Define available test options
const availableTests = {
  prompts: "Test the standard prompts functionality",
  "list-tools": "Test the tool listing functionality",
  "list-procedures": "Test the listProcedures tool",
  "procedure-details": "Test the getProcedureDetails tool",
  "procedure-step": "Test the getProcedureStep tool",
  "search-procedures": "Test the searchProcedures tool",
  all: "Run all tests sequentially",
};

// Parse command line arguments to determine which tests to run
const args = process.argv.slice(2);
let testFilter = "";
let apiUrl = "";

// Parse command line arguments
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--api-url" && i + 1 < args.length) {
    apiUrl = args[i + 1];
    i++; // Skip the next argument since we've processed it
  } else if (!testFilter) {
    testFilter = args[i].toLowerCase();
  }
}

// If no arguments provided or help requested, display available options
if (
  !testFilter ||
  testFilter === "help" ||
  testFilter === "-h" ||
  testFilter === "--help"
) {
  console.log("\nAvailable test options:");

  const maxLength = Math.max(
    ...Object.keys(availableTests).map((k) => k.length)
  );
  Object.entries(availableTests).forEach(([name, description]) => {
    console.log(`  ${name.padEnd(maxLength + 2)}${description}`);
  });

  console.log("\nUsage:");
  console.log("  node dist/test-client.js [test-name] [--api-url <url>]\n");
  process.exit(0);
}

async function main() {
  console.log("Starting eRegulations MCP test client...");

  console.log("Launching MCP server with stdio transport");
  // Pass through environment variables, especially EREGULATIONS_API_URL
  // Create a type-safe environment object by filtering out undefined values
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      env[key] = value;
    }
  }

  // Use API URL from command line argument if provided, otherwise from environment
  const apiUrlArg =
    apiUrl || process.env.EREGULATIONS_API_URL
      ? ["--api-url", apiUrl || process.env.EREGULATIONS_API_URL || ""]
      : [];

  if (apiUrlArg.length > 0) {
    console.log(`Using API URL: ${apiUrlArg[1]}`);
  } else {
    console.warn(
      "Warning: No API URL provided. Please set EREGULATIONS_API_URL environment variable or use --api-url argument."
    );
  }

  const transport = new StdioClientTransport({
    command: "node",
    args: [path.join(__dirname, "../dist/index.js"), ...apiUrlArg],
    env,
  });

  const client = new Client(
    {
      name: "eregulations-test-client",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
        prompts: true, // Enable standard prompts capability
      },
    }
  );

  let allPassed = true;

  try {
    console.log("Connecting to MCP server...");
    await client.connect(transport);
    console.log("Connected successfully!");

    // Define test functions for each feature
    const tests = {
      // Test prompts functionality
      prompts: async () => {
        console.log("\n=== Testing Standard Prompts ===");
        try {
          // List available prompts
          const promptsResponse = await client.listPrompts();

          if (promptsResponse && promptsResponse.prompts) {
            console.log("Prompts received successfully!");
            console.log(`Found ${promptsResponse.prompts.length} prompts.`);

            // Display each prompt
            console.log("\nAvailable Prompts:");
            promptsResponse.prompts.forEach((prompt) => {
              console.log(`\n--- ${prompt.name} ---`);
              console.log(`Description: ${prompt.description}`);
              if (prompt.arguments && prompt.arguments.length) {
                console.log("Arguments:");
                prompt.arguments.forEach((arg) => {
                  console.log(
                    `  - ${arg.name}: ${arg.description} ${
                      arg.required ? "(required)" : "(optional)"
                    }`
                  );
                });
              }
            });

            // Test getting a specific prompt
            if (promptsResponse.prompts.length > 0) {
              const firstPrompt = promptsResponse.prompts[0].name;
              console.log(`\nTesting getPrompt for "${firstPrompt}":`);

              const promptResult = await client.getPrompt({
                name: firstPrompt,
                arguments: {},
              });

              if (promptResult && promptResult.messages) {
                console.log(
                  `Successfully received prompt template with ${promptResult.messages.length} messages.`
                );
                console.log("First message preview:");
                const firstMsg = promptResult.messages[0];
                // Type-safe access to message content
                if (
                  firstMsg.content &&
                  typeof firstMsg.content === "object" &&
                  "text" in firstMsg.content &&
                  typeof firstMsg.content.text === "string"
                ) {
                  // Show first few lines
                  const previewLines = firstMsg.content.text
                    .split("\n")
                    .slice(0, 5);
                  console.log(previewLines.join("\n") + "\n...");
                }
                return true;
              } else {
                console.log("No prompt content received or unexpected format.");
                return false;
              }
            }
            return true;
          } else {
            console.log(
              "No prompts available or unexpected response format:",
              promptsResponse
            );
            return false;
          }
        } catch (error: any) {
          console.error("Error testing prompts:", error.message || error);
          return false;
        }
      },

      // Test listing tools
      "list-tools": async () => {
        console.log("\n=== Testing Tool Listing ===");
        try {
          const toolList = await client.listTools();
          console.log(`Found ${toolList.tools.length} tools:`);

          for (const tool of toolList.tools) {
            console.log(`- ${tool.name}: ${tool.description}`);
          }
          return true;
        } catch (error: any) {
          console.error("Error listing tools:", error.message || error);
          return false;
        }
      },

      // Test listProcedures tool
      "list-procedures": async () => {
        console.log("\n=== Testing listProcedures Tool ===");
        try {
          const listResult = await client.callTool({
            name: "listProcedures",
            arguments: {},
          });

          console.log("\nProcedures Summary:");
          let errorOccurred = false;
          let errorMessage = "";

          if (listResult.content && Array.isArray(listResult.content)) {
            // Check if there's an error message in the content
            for (const item of listResult.content) {
              if (
                item.type === "text" &&
                item.text.includes("Error retrieving procedures:")
              ) {
                errorOccurred = true;
                errorMessage = item.text;
                break;
              }
            }

            // Print the text content (not the JSON)
            listResult.content.forEach((item: any) => {
              if (item.type === "text" && !item.text.startsWith("```")) {
                // Limit output to first few lines for brevity
                const lines = item.text.split("\n");
                console.log(lines.slice(0, 10).join("\n") + "\n...");
              }
            });
          }

          if (errorOccurred) {
            console.error(`\nError in listProcedures: ${errorMessage}`);
            return false; // Test fails on API error
          }

          return true;
        } catch (error: any) {
          console.error(
            "Error calling listProcedures:",
            error.message || error
          );
          return false;
        }
      },

      // Test getProcedureDetails tool
      "procedure-details": async () => {
        console.log("\n=== Testing getProcedureDetails Tool ===");
        try {
          console.log("\nGetting details for procedure ID 362:");
          const detailsResult = await client.callTool({
            name: "getProcedureDetails",
            arguments: {
              procedureId: 362, // Using a valid procedure ID
            },
          });

          let errorOccurred = false;
          let errorMessage = "";

          if (detailsResult.content && Array.isArray(detailsResult.content)) {
            // Check for errors in the content
            for (const item of detailsResult.content) {
              if (
                item.type === "text" &&
                item.text.includes("Error retrieving procedure details:")
              ) {
                errorOccurred = true;
                errorMessage = item.text;
                break;
              }
            }

            // Print first 15 lines of the procedure details
            const textContent = detailsResult.content.find(
              (item: any) =>
                item.type === "text" && !item.text.startsWith("```")
            );

            if (textContent) {
              const lines = textContent.text.split("\n");
              console.log(lines.slice(0, 15).join("\n") + "\n...");
            }
          }

          if (errorOccurred) {
            console.error(`\nError in getProcedureDetails: ${errorMessage}`);
            return false; // Test fails on API error
          }

          return true;
        } catch (error: any) {
          console.error(
            "Error calling getProcedureDetails:",
            error.message || error
          );
          return false;
        }
      },

      // Test getProcedureStep tool
      "procedure-step": async () => {
        console.log("\n=== Testing getProcedureStep Tool ===");
        try {
          // Test with a known procedure step (Contract a clearing agent)
          console.log("\nGetting details for step ID 384 in procedure 1244:");
          const stepResult = await client.callTool({
            name: "getProcedureStep",
            arguments: {
              procedureId: 362,
              stepId: 384,
            },
          });

          let errorOccurred = false;
          let errorMessage = "";

          if (stepResult.content && Array.isArray(stepResult.content)) {
            // Check for errors in the content
            for (const item of stepResult.content) {
              if (
                item.type === "text" &&
                item.text.includes("Error retrieving procedure step:")
              ) {
                errorOccurred = true;
                errorMessage = item.text;
                break;
              }
            }

            // Print the formatted step information
            const textContent = stepResult.content.find(
              (item: any) =>
                item.type === "text" && !item.text.startsWith("```")
            );

            if (textContent) {
              console.log(textContent.text);
            }
          }

          if (errorOccurred) {
            console.error(`\nError in getProcedureStep: ${errorMessage}`);
            return false; // Test fails on API error
          }

          return true;
        } catch (error: any) {
          console.error(
            "Error calling getProcedureStep:",
            error.message || error
          );
          return false;
        }
      },

      // Test searchProcedures tool
      "search-procedures": async () => {
        console.log("\n=== Testing searchProcedures Tool ===");
        const keyword = "import"; // Example search term
        try {
          console.log(`\nSearching procedures with keyword: "${keyword}"`);
          const searchResult = await client.callTool({
            name: "searchProcedures",
            arguments: { keyword: keyword },
          });

          let errorOccurred = false;
          let errorMessage = "";

          if (searchResult.content && Array.isArray(searchResult.content)) {
            // Check for errors
            for (const item of searchResult.content) {
              if (
                item.type === "text" &&
                item.text.includes("Error searching for procedures:")
              ) {
                errorOccurred = true;
                errorMessage = item.text;
                break;
              }
            }

            // Print first 15 lines of the search results summary
            const textContent = searchResult.content.find(
              (item: any) =>
                item.type === "text" && !item.text.startsWith("```")
            );

            if (textContent) {
              const lines = textContent.text.split("\n");
              console.log(
                lines.slice(0, 15).join("\n") +
                  (lines.length > 15 ? "\n..." : "")
              );
            } else {
              console.log("(No text summary found in response)");
            }
          } else {
            console.log("(Unexpected response format)");
          }

          if (errorOccurred) {
            console.error(`\nError in searchProcedures: ${errorMessage}`);
            return false; // Test fails on API error
          }

          return true; // Test passes if no API error found in response
        } catch (error: any) {
          console.error(
            "Error calling searchProcedures:",
            error.message || error
          );
          return false; // Test fails on client-level error
        }
      },
    };

    // Validate that the selected test exists
    if (testFilter !== "all" && !Object.keys(tests).includes(testFilter)) {
      console.error(`Error: Test "${testFilter}" not found.`);
      process.exit(1);
    }

    // Run selected tests
    for (const testName in tests) {
      if (testName === testFilter || testFilter === "all") {
        console.log(`\nRunning test: ${testName}`);
        const testResult = await tests[testName as keyof typeof tests]();
        if (!testResult) {
          console.error(`Test "${testName}" failed.`);
          allPassed = false;
        }
      }
    }

    if (allPassed) {
      console.log("\nAll tests passed!");
    } else {
      console.error("\nSome tests failed.");
    }
  } catch (error: any) {
    console.error("Error running tests:", error.message || error);
    process.exit(1);
  }
}

main();
