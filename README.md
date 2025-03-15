# eRegulations MCP Server

A Model Context Protocol (MCP) server implementation for accessing eRegulations API data. This server provides structured, AI-friendly access to eRegulations instances, making it easier for AI models to answer user questions about administrative procedures.

## Features

- Access eRegulations data through a standardized protocol
- Query procedures, steps, requirements, and costs
- Search for procedures by name or criteria
- Support for both standard I/O and HTTP connections

## Installation

```bash
# Clone the repository
git clone [your-repository-url]
cd eregulations-mcp-server

# Install dependencies
npm install

# Build the project
npm run build
```

## Configuration

The server can be configured using environment variables:

- `EREGULATIONS_API_URL`: URL of the eRegulations API to connect to (default: `https://api-tanzania.tradeportal.org`)
- `PORT`: Port for the HTTP server when using SSE transport (default: `3001`)

## Usage

### Standard I/O Mode

For integration with LLM systems that support MCP over standard I/O:

```bash
npm start
```

### HTTP Server Mode

For integration with web-based clients or systems that support SSE:

```bash
node dist/sse.js
```

Once running, the server can be connected to at `http://localhost:3001/sse`.

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

Searches for procedures by name or applies specified filters.

Parameters:
- `query`: Search query for procedures
- `filters`: Optional filters to apply (array format matching eRegulations API)

## Development

```bash
# Run in development mode
npm run dev

# Run tests
npm test

# Run tests with watch mode
npm run test:watch
```

## License

MIT