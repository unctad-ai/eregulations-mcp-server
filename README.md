# eRegulations MCP Server

[![smithery badge](https://smithery.ai/badge/@unctad-ai/eregulations-mcp-server)](https://smithery.ai/server/@unctad-ai/eregulations-mcp-server)

A Model Context Protocol (MCP) server implementation for accessing eRegulations API data. This server provides structured, AI-friendly access to eRegulations instances, making it easier for AI models to answer user questions about administrative procedures.

<a href="https://glama.ai/mcp/servers/@unctad-ai/eregulations-mcp-server">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@unctad-ai/eregulations-mcp-server/badge" alt="eRegulations Server MCP server" />
</a>

## Features

- Access eRegulations data through a standardized protocol
- Query procedures, steps, requirements, and costs
- MCP prompt templates to guide LLM tool usage
- Streamlined implementation using standard I/O connections

## Usage

### Running with Docker (Recommended)

The recommended way to run the server is using the published Docker image from the GitHub Container Registry (GHCR). This ensures a consistent and isolated environment.

```bash
# Pull the latest image (optional)
docker pull ghcr.io/unctad-ai/eregulations-mcp-server:latest

# Run the server, providing the target eRegulations API URL
export EREGULATIONS_API_URL="https://your-eregulations-api.com"
docker run -i --rm -e EREGULATIONS_API_URL ghcr.io/unctad-ai/eregulations-mcp-server
```

Replace `https://your-eregulations-api.com` with the actual base URL of the eRegulations instance you want to connect to (e.g., `https://api-tanzania.tradeportal.org`).

The server listens for MCP JSON requests on standard input and sends responses to standard output.

### Example Client Configuration

Here's an example of how a client (like Claude) might be configured to use this server via Docker:

```json
{
  "mcpServers": {
    "eregulations": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e",
        "EREGULATIONS_API_URL",
        "ghcr.io/unctad-ai/eregulations-mcp-server:latest"
      ],
      "env": {
        "EREGULATIONS_API_URL": "https://your-eregulations-api.com"
      }
    }
  }
}
```

(Remember to replace the `EREGULATIONS_API_URL` value in the `env` section as well.)

### Installation via Smithery

Alternatively, you can install and run the server using Smithery:

Visit [https://smithery.ai/server/@unctad-ai/eregulations-mcp-server](https://smithery.ai/server/@unctad-ai/eregulations-mcp-server) for the installation command.

### Installation via npm Registry (Deprecated)

~~Running the server directly using `npx` is deprecated due to potential environment inconsistencies.~~

~~```bash

# Deprecated: Set environment variables and run with npx

export EREGULATIONS_API_URL=https://example.com/api && export NODE_ENV=production && npx -y @unctad-ai/eregulations-mcp-server@latest

````~~

## Configuration

The server requires the URL of the target eRegulations API.

### Environment Variables

- `EREGULATIONS_API_URL`: **(Required)** URL of the eRegulations API to connect to (e.g., `https://api-tanzania.tradeportal.org`). Passed to the Docker container using the `-e` flag.

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

### `searchProcedures`

Searches for procedures by keyword or phrase. Note: This currently searches related objectives based on the underlying API and may include results beyond direct procedure names.

Parameters:

- `keyword`: The keyword or phrase to search for

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