# eRegulations MCP Server

[![smithery badge](https://smithery.ai/badge/@unctad-ai/eregulations-mcp-server)](https://smithery.ai/server/@unctad-ai/eregulations-mcp-server)
[![Test Coverage](https://img.shields.io/badge/coverage-88.18%25-brightgreen)](https://github.com/unctad-ai/eregulations-mcp-server/tree/main/coverage)

A Model Context Protocol (MCP) server implementation for accessing eRegulations API data. This server provides structured, AI-friendly access to eRegulations instances, making it easier for AI models to answer user questions about administrative procedures.

## Features

- Access eRegulations data through a standardized protocol
- Query procedures, steps, requirements, and costs
- MCP prompt templates to guide LLM tool usage
- Support for both standard I/O and HTTP connections

## Installation

```bash
# Clone the repository
git clone https://github.com/benmoumen/eregulations-mcp-server.git
cd eregulations-mcp-server

# Install dependencies
npm install

# Build the project
npm run build
```

## Configuration

The server can be configured using environment variables:

- `EREGULATIONS_API_URL`: URL of the eRegulations API to connect to
- `PORT`: Port for the HTTP server when using SSE transport (default: `7000`)

## Usage

### Standard I/O Mode (recommended)

For integration with LLM systems that support MCP over standard I/O:

```bash
node dist/index.js
```

### HTTP Server Mode

For integration with web-based clients or systems that support SSE:

```bash
node dist/sse.js
```

Once running, the server can be connected to at `http://localhost:7000/sse`.

### Docker Compose Deployment

You can deploy the MCP server and SSE transport using Docker Compose:

```bash
# Build and start the containers
docker-compose up -d

# To stop the containers
docker-compose down
```

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
npm run dev

# Run tests
npm test

# Run tests with watch mode
npm run test:watch

# Run test client
npm run test-client
```

## License

MIT