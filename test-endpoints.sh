#!/bin/bash

# Color definitions
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Testing MCP Server Endpoints${NC}"
echo "==============================="

# Test the health endpoint
echo -e "\n${YELLOW}Testing /health endpoint:${NC}"
HEALTH_RESPONSE=$(curl -s -w "%{http_code}" https://mcp.eregistrations.dev/health -o /dev/null)
if [ "$HEALTH_RESPONSE" == "200" ]; then
  echo -e "${GREEN}✓ Health endpoint is accessible${NC}"
else
  echo -e "${RED}✗ Health endpoint returned HTTP $HEALTH_RESPONSE${NC}"
fi

# Test the SSE endpoint
echo -e "\n${YELLOW}Testing /sse endpoint:${NC}"
SSE_RESPONSE=$(curl -s -w "%{http_code}" https://mcp.eregistrations.dev/sse -o /dev/null)
if [ "$SSE_RESPONSE" == "200" ]; then
  echo -e "${GREEN}✓ SSE endpoint is accessible${NC}"
else
  echo -e "${RED}✗ SSE endpoint returned HTTP $SSE_RESPONSE${NC}"
fi

# Test the message endpoint
echo -e "\n${YELLOW}Testing /message endpoint:${NC}"
MESSAGE_RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -d '{"type":"ping"}' -w "%{http_code}" https://mcp.eregistrations.dev/message -o /dev/null)
if [[ "$MESSAGE_RESPONSE" == "200" || "$MESSAGE_RESPONSE" == "202" ]]; then
  echo -e "${GREEN}✓ Message endpoint is accessible${NC}"
else
  echo -e "${RED}✗ Message endpoint returned HTTP $MESSAGE_RESPONSE${NC}"
fi