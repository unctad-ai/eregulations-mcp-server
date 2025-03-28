#!/bin/bash
# Script to generate coverage report and update the summary JSON

# Run tests with coverage
npm test -- --coverage

# Generate coverage summary JSON file
npx istanbul report json-summary --include coverage/coverage-final.json --dir coverage/

echo "Coverage summary updated in coverage/coverage-summary.json"