# Test Coverage Improvement Plan

## Current Coverage Status

As of March 28, 2025, the test coverage for the eRegulations MCP Server project is:

- **Statements/Lines**: 33.62% (Target: 70%)
- **Branches**: 75.98% (Target: 60%) ✅
- **Functions**: 67.6% (Target: 70%)

The branch coverage exceeds our target, but we need significant improvement in both statement/line coverage and function coverage.

## Priority Areas for Coverage Improvement

Based on the coverage report, we should focus on the following areas, listed in order of priority:

### 1. MCP Capabilities Handlers (0% coverage)

This is one of the core components of our MCP implementation and should be thoroughly tested:

- [ ] `src/mcp-capabilities/tools/handlers/get-procedure-details.ts`
- [ ] `src/mcp-capabilities/tools/handlers/get-procedure-step.ts`
- [ ] `src/mcp-capabilities/tools/handlers/list-procedures.ts`
- [ ] `src/mcp-capabilities/tools/handlers/index.ts`
- [ ] Create test fixtures representing typical API responses
- [ ] Test error handling and edge cases

### 2. Utility Classes (50.55% coverage)

These utilities are used throughout the codebase and need proper testing:

- [ ] `src/utils/cache.ts` (0% coverage)
- [ ] Improve coverage for `src/utils/db-cache.ts` (currently 66.07%)
- [ ] Improve coverage for `src/utils/logger.ts` (currently 59.09%)

### 3. Transport Layer (7.24% coverage)

Test the core server components and transports:

- [ ] `src/index.ts` (entry point)
- [ ] Improve coverage for `src/mcp-server.ts` (currently 38.59%)
- [ ] `src/sse.ts` (Server-Sent Events implementation)
- [ ] `src/test-client.ts`

### 4. MCP Tools and Schemas (partial coverage)

- [ ] `src/mcp-capabilities/tools/schemas.ts` (0% coverage)
- [ ] `src/mcp-capabilities/tools/formatters/index.ts` (0% coverage)
- [ ] Add tests for remaining type definitions

### 5. Services (86.48% coverage)

- [ ] Improve coverage for `src/services/eregulations-api.ts` (fill remaining gaps)

## Testing Approach

1. **Unit Tests**:
   - Mock external API calls and dependencies
   - Focus on testing core business logic
   - Create comprehensive test fixtures for API responses

2. **Integration Tests**:
   - Test the interaction between components
   - Verify MCP tools work correctly with the eRegulations API service

3. **Transport Tests**:
   - Test both stdio and SSE transports
   - Verify correct handling of MCP protocol messages

## Sample Code (Optional)

Sample code is used for demonstration purposes and is not part of the core library:

- [ ] Consider if we need to test sample code, or exclude it from coverage requirements

## Timeline

- Week 1: Focus on handler tests (MCP capabilities)
- Week 2: Utility classes and services
- Week 3: Transport layer and remaining components

## Guidelines for Writing Tests

1. Follow the existing test patterns in the project
2. Use descriptive test names that explain the behavior being tested
3. Test both happy paths and error handling
4. Use parameterized tests when testing similar behavior with different inputs

## Progress Tracking

Run coverage reports regularly to track progress:
```
npm run test:coverage
```

The goal is to meet all coverage thresholds:
- Lines: 70%
- Functions: 70%
- Branches: 60%
- Statements: 70%