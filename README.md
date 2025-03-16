# eRegulations MCP Server

A Model Context Protocol (MCP) server implementation for accessing eRegulations API data. This server provides structured, AI-friendly access to eRegulations instances, making it easier for AI models to answer user questions about administrative procedures.

## Features

- Access eRegulations data through a standardized protocol
- Query procedures, steps, requirements, and costs
- Search for procedures by name
- MCP prompt templates to guide LLM tool usage
- Support for both standard I/O and HTTP connections

## Installation

```bash
# Clone the repository
git clone https://github.com/benmoumen/eregulations-mcp-server
cd eregulations-mcp-server

# Install dependencies
npm install

# Build the project
npm run build
```

## Configuration

The server can be configured using environment variables:

- `EREGULATIONS_API_URL`: URL of the eRegulations API to connect to (default: `https://api-tanzania.tradeportal.org`)
- `PORT`: Port for the HTTP server when using SSE transport (default: `7000`)

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

Once running, the server can be connected to at `http://localhost:7000/sse`.

### Docker Compose Deployment

You can deploy the MCP server and SSE transport using Docker Compose:

```bash
# Build and start the containers
docker-compose up -d

# To stop the containers
docker-compose down
```

The Docker Compose setup includes:
- eRegulations MCP server

Nginx is configured to serve:
- The eRegulations MCP server at `/eregulations`

To add additional MCP servers, modify the `docker-compose.yml` and `nginx.conf` files.

Each MCP server is configured to listen on a different port, allowing multiple servers to be run simultaneously.

### Nginx Location for eRegulations MCP server
```
location /eregulations/ {
    proxy_pass http://127.0.0.1:7000/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    # Additional SSE-specific settings
    proxy_set_header Connection '';
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 86400s; # 24 hours
}
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

### `searchProcedures`

Searches for procedures by text.

Parameters:
- `query`: Optional text search query

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