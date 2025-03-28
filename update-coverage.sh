#!/bin/bash
# Script to generate coverage report and update the summary JSON and badge

# Run tests with coverage
npm run test:coverage

# Ensure the coverage directory exists
mkdir -p coverage

# Generate the coverage summary JSON
npx istanbul report json-summary --include coverage/coverage-final.json --dir coverage/

# Extract coverage percentage
COVERAGE=$(node -e "console.log(JSON.parse(require('fs').readFileSync('./coverage/coverage-summary.json')).total.statements.pct)")

# Create a badge SVG file (determine color based on coverage)
COLOR=$(node -e "const cov = $COVERAGE; console.log(cov > 80 ? 'brightgreen' : cov > 70 ? 'green' : cov > 60 ? 'yellowgreen' : cov > 50 ? 'yellow' : 'red')")
curl -s "https://img.shields.io/badge/coverage-${COVERAGE}%25-${COLOR}" > coverage/badge.svg

echo "Coverage summary updated in coverage/coverage-summary.json"
echo "Coverage badge updated in coverage/badge.svg"