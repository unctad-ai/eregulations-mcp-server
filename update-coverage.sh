#!/bin/bash
# Script to generate coverage report and update the summary JSON

# Run tests with coverage
npm run test:coverage

# Ensure the coverage directory exists
mkdir -p coverage

# Generate the coverage summary JSON
npx istanbul report json-summary --include coverage/coverage-final.json --dir coverage/

# Extract coverage percentage
COVERAGE=$(node -e "console.log(JSON.parse(require('fs').readFileSync('./coverage/coverage-summary.json')).total.statements.pct)")

# Determine color based on coverage
if (( $(echo "$COVERAGE > 80" | bc -l) )); then
  COLOR="brightgreen"
elif (( $(echo "$COVERAGE > 70" | bc -l) )); then
  COLOR="green"
elif (( $(echo "$COVERAGE > 60" | bc -l) )); then
  COLOR="yellowgreen"
elif (( $(echo "$COVERAGE > 50" | bc -l) )); then
  COLOR="yellow"
else
  COLOR="red"
fi

# Update the README badge URL
sed -i "s|https://img.shields.io/badge/coverage-[0-9.]*%25-[a-z]*|https://img.shields.io/badge/coverage-${COVERAGE}%25-${COLOR}|g" README.md

echo "Coverage summary updated in coverage/coverage-summary.json"
echo "Coverage badge updated in README.md"