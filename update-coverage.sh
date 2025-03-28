#!/bin/bash
# Script to generate coverage report and update the summary JSON

# Run tests with coverage
npm run test:coverage

# Ensure the coverage directory exists
mkdir -p coverage

# If coverage-final.json exists but not coverage-summary.json, create it
if [ -f "coverage/coverage-final.json" ] && [ ! -f "coverage/coverage-summary.json" ]; then
  echo "Converting coverage-final.json to coverage-summary.json format..."
  
  # Install the necessary package if not already installed
  if ! npm list -g | grep -q "istanbul-reports"; then
    npm install -g istanbul-reports
  fi
  
  # Generate summary from the final coverage report
  npx istanbul report json-summary --include coverage/coverage-final.json --dir coverage/
fi

echo "Coverage summary updated in coverage/coverage-summary.json"