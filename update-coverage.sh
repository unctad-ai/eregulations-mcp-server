#!/bin/bash
# Script to run tests and verify coverage meets thresholds

# Run tests with coverage
npm run test:coverage

# Extract coverage metrics
COVERAGE=$(cat coverage/coverage-final.json | grep -o '"statements":{"total":[0-9]*,"covered":[0-9]*,"pct":[0-9.]*' | grep -o 'pct":[0-9.]*' | grep -o '[0-9.]*' | head -n 1)
BRANCH_COVERAGE=$(cat coverage/coverage-final.json | grep -o '"branches":{"total":[0-9]*,"covered":[0-9]*,"pct":[0-9.]*' | grep -o 'pct":[0-9.]*' | grep -o '[0-9.]*' | head -n 1)
FUNCTION_COVERAGE=$(cat coverage/coverage-final.json | grep -o '"functions":{"total":[0-9]*,"covered":[0-9]*,"pct":[0-9.]*' | grep -o 'pct":[0-9.]*' | grep -o '[0-9.]*' | head -n 1)

echo "Statement coverage: $COVERAGE%"
echo "Branch coverage: $BRANCH_COVERAGE%"
echo "Function coverage: $FUNCTION_COVERAGE%"

# Check against thresholds
STATEMENT_THRESHOLD=70
BRANCH_THRESHOLD=60
FUNCTION_THRESHOLD=70

failed=0

if (( $(echo "$COVERAGE < $STATEMENT_THRESHOLD" | bc -l) )); then
  echo "❌ Statement coverage ($COVERAGE%) is below threshold ($STATEMENT_THRESHOLD%)"
  failed=1
fi

if (( $(echo "$BRANCH_COVERAGE < $BRANCH_THRESHOLD" | bc -l) )); then
  echo "❌ Branch coverage ($BRANCH_COVERAGE%) is below threshold ($BRANCH_THRESHOLD%)"
  failed=1
fi

if (( $(echo "$FUNCTION_COVERAGE < $FUNCTION_THRESHOLD" | bc -l) )); then
  echo "❌ Function coverage ($FUNCTION_COVERAGE%) is below threshold ($FUNCTION_THRESHOLD%)"
  failed=1
fi

if [ $failed -eq 0 ]; then
  echo "✅ All coverage thresholds passed!"
else
  echo "⚠️ Some coverage thresholds were not met."
  exit 1
fi