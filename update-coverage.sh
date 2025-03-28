#!/bin/bash
# Script to run tests and update the coverage badge in README

# Run tests with coverage and extract percentage from report
npm run test:coverage || true
COVERAGE=$(cat coverage/coverage-final.json | grep -o '"statements":{"total":[0-9]*,"covered":[0-9]*,"pct":[0-9.]*' | grep -o 'pct":[0-9.]*' | grep -o '[0-9.]*' | head -n 1)

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

echo "Coverage: $COVERAGE%"
echo "Coverage badge updated in README.md"