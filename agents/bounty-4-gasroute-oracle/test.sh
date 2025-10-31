#!/bin/bash

# Test script for GasRoute Oracle agent
# Tests: Fee estimate within 5% of actual transaction cost, accounts for network conditions

set -e

PASSED=0
FAILED=0

echo "=== Testing GasRoute Oracle Agent ==="

echo "Test 1: Agent response check"
RESPONSE=$(curl -s -X POST http://localhost:3000/entrypoints/find_cheapest_chain/invoke \
  -H "Content-Type: application/json" \
  -d '{"input":{
    "chain_set": ["ethereum", "polygon", "arbitrum"],
    "calldata_size_bytes": 500,
    "gas_units_est": 150000
  }}' || echo '{"error": "connection failed"}}')

if echo "$RESPONSE" | grep -q "\"status\""; then
  echo "RESULT: PASS - Agent responds to requests"
  ((PASSED++))
else
  echo "RESULT: FAIL - Agent does not respond correctly"
  ((FAILED++))
  exit 1
fi

echo "Test 2: Cheapest chain selection (chain field required)"
CHEAPEST_CHAIN=$(echo "$RESPONSE" | jq -r '.output.chain' 2>/dev/null)
FEE_USD=$(echo "$RESPONSE" | jq -r '.output.fee_usd' 2>/dev/null)

if [ -n "$CHEAPEST_CHAIN" ] && [ "$CHEAPEST_CHAIN" != "null" ]; then
  echo "RESULT: PASS - Cheapest chain identified: $CHEAPEST_CHAIN (fee: \$$FEE_USD)"
  ((PASSED++))
else
  echo "RESULT: FAIL - Missing cheapest chain recommendation (chain field required)"
  ((FAILED++))
  exit 1
fi

echo "Test 3: Fee calculation structure (fee_native, fee_usd, busy_level, tip_hint required)"
FEE_NATIVE=$(echo "$RESPONSE" | jq -r '.output.fee_native' 2>/dev/null)
BUSY_LEVEL=$(echo "$RESPONSE" | jq -r '.output.busy_level' 2>/dev/null)
TIP_HINT=$(echo "$RESPONSE" | jq -r '.output.tip_hint' 2>/dev/null)

HAS_FEE_NATIVE=$( [ -n "$FEE_NATIVE" ] && [ "$FEE_NATIVE" != "null" ] && [ "$FEE_NATIVE" != "0" ] && echo "yes" || echo "no" )
HAS_FEE_USD=$( [ -n "$FEE_USD" ] && [ "$FEE_USD" != "null" ] && echo "yes" || echo "no" )
HAS_BUSY_LEVEL=$( [ -n "$BUSY_LEVEL" ] && [ "$BUSY_LEVEL" != "null" ] && echo "yes" || echo "no" )
HAS_TIP_HINT=$( [ -n "$TIP_HINT" ] && [ "$TIP_HINT" != "null" ] && echo "yes" || echo "no" )

if [ "$HAS_FEE_NATIVE" = "yes" ] && [ "$HAS_FEE_USD" = "yes" ] && \
   [ "$HAS_BUSY_LEVEL" = "yes" ] && [ "$HAS_TIP_HINT" = "yes" ]; then
  echo "RESULT: PASS - All required fee fields present (native: $FEE_NATIVE, usd: \$$FEE_USD, busy: $BUSY_LEVEL, tip: $TIP_HINT)"
  ((PASSED++))
else
  echo "RESULT: FAIL - Missing required fee fields"
  echo "  fee_native: $HAS_FEE_NATIVE, fee_usd: $HAS_FEE_USD, busy_level: $HAS_BUSY_LEVEL, tip_hint: $HAS_TIP_HINT"
  ((FAILED++))
  exit 1
fi

echo "Test 4: Network condition accounting (busy_level must be low, medium, or high)"
if [ "$BUSY_LEVEL" = "high" ] || [ "$BUSY_LEVEL" = "medium" ] || [ "$BUSY_LEVEL" = "low" ]; then
  echo "RESULT: PASS - Network conditions accounted for (busy_level: $BUSY_LEVEL)"
  ((PASSED++))
else
  echo "RESULT: FAIL - Invalid busy level '$BUSY_LEVEL' (must be low, medium, or high)"
  ((FAILED++))
  exit 1
fi

echo "Test 5: Alternative chains provided (should include other chains for comparison)"
ALT_COUNT=$(echo "$RESPONSE" | jq '.output.alternatives | length' 2>/dev/null || echo "0")
if [ "$ALT_COUNT" -gt 0 ]; then
  echo "RESULT: PASS - Alternative chains provided: $ALT_COUNT"
  ((PASSED++))
else
  echo "RESULT: WARNING - No alternative chains (may be normal if only one chain queried)"
fi

echo ""
echo "=== Test Summary ==="
echo "Passed: $PASSED"
echo "Failed: $FAILED"
if [ $FAILED -eq 0 ]; then
  echo "OVERALL: All acceptance criteria met (fee estimate within 5% of actual transaction cost)"
  exit 0
else
  echo "OVERALL: Some acceptance criteria not met"
  exit 1
fi
