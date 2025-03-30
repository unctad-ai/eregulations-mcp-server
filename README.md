# eRegulations MCP Server

[![smithery badge](https://smithery.ai/badge/@unctad-ai/eregulations-mcp-server)](https://smithery.ai/server/@unctad-ai/eregulations-mcp-server)

A Model Context Protocol (MCP) server implementation for accessing eRegulations API data. This server provides structured, AI-friendly access to eRegulations instances, making it easier for AI models to answer user questions about administrative procedures.

## Features

- Access eRegulations data through a standardized protocol
- Query procedures, steps, requirements, and costs
- MCP prompt templates to guide LLM tool usage
- Streamlined implementation using standard I/O connections

## Installation

### Quick Installation with Smithery

The easiest way to install and run the eRegulations MCP Server is through Smithery:

Visit [https://smithery.ai/server/@unctad-ai/eregulations-mcp-server](https://smithery.ai/server/@unctad-ai/eregulations-mcp-server) for the installation command.

### Installation via npm Registry

You can also run the eRegulations MCP Server directly using npx with the published npm package:

```bash
# Set environment variables and run with npx
export EREGULATIONS_API_URL=https://example.com/api && export NODE_ENV=production && npx -y @unctad-ai/eregulations-mcp-server@latest
```


## Configuration

The server can be configured using command-line arguments (preferred) or environment variables:

### Command-line Arguments
- `--api-url`: URL of the eRegulations API to connect to

### Environment Variables
- `EREGULATIONS_API_URL`: URL of the eRegulations API to connect to (fallback if --api-url is not provided)

**Note**: Command-line arguments take precedence over environment variables.

## Available Tools

The MCP server provides the following tools:

### `listProcedures`

Lists all available procedures in the eRegulations system.

### `getProcedureDetails`

Gets detailed information about a specific procedure by its ID.

Parameters:
- `procedureId`: ID of the procedure to retrieve

### `getProcedureStep`

Gets information about a specific step within a procedure.

Parameters:
- `procedureId`: ID of the procedure
- `stepId`: ID of the step within the procedure

## Prompt Templates

The server provides prompt templates to guide LLMs in using the available tools correctly. These templates explain the proper format and parameters for each tool. LLM clients that support the MCP prompt templates capability will automatically receive these templates to improve their ability to work with the API.

## Development

```bash
# Run in development mode
npm run start

# Run tests
npm test

# Run tests with watch mode
npm run test:watch

# Run test client
npm run test-client
```
