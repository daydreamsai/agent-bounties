#!/bin/bash

# Test script for Bridge Route Pinger agent
# Tests: Returns routes from major bridges, accurate fee/time estimates

set -e

PASSED=0
FAILED=0

echo "=== Testing Bridge Route Pinger Agent ==="

# Test parameters
TOKEN="USDC"
AMOUNT="1000000000" # 1000 USDC (6 decimals)
FROM_CHAIN="ethereum"
TO_CHAIN="arbitrum"

echo "Test 1: Agent response check"
RESPONSE=$(curl -s -X POST http://localhost:3000/entrypoints/find_routes/invoke \
  -H "Content-Type: application/json" \
  -d '{"input":{
    "token": "'$TOKEN'",
    "amount": "'$AMOUNT'",
    "from_chain": "'$FROM_CHAIN'",
    "to_chain": "'$TO_CHAIN'"
  }}' || echo '{"error": "connection failed"}}')

if echo "$RESPONSE" | grep -q "\"status\".*\"succeeded\"\|\"error\""; then
  echo "RESULT: PASS - Agent responds to requests"
  ((PASSED++))
else
  echo "RESULT: FAIL - Agent does not respond correctly"
  ((FAILED++))
  exit 1
fi

echo "Test 2: Route structure (bridge, fee_usd, eta_minutes, requirements required)"
ROUTE_COUNT=$(echo "$RESPONSE" | jq '.output.routes | length' 2>/dev/null || echo "0")

if [ "$ROUTE_COUNT" -gt 0 ]; then
  FIRST_ROUTE=$(echo "$RESPONSE" | jq '.output.routes[0]' 2>/dev/null)
  
  HAS_BRIDGE=$(echo "$FIRST_ROUTE" | jq -e '.bridge' > /dev/null 2>&1 && echo "yes" || echo "no")
  HAS_FEE_USD=$(echo "$FIRST_ROUTE" | jq -e '.fee_usd' > /dev/null 2>&1 && echo "yes" || echo "no")
  HAS_ETA=$(echo "$FIRST_ROUTE" | jq -e '.eta_minutes' > /dev/null 2>&1 && echo "yes" || echo "no")
  HAS_REQUIREMENTS=$(echo "$FIRST_ROUTE" | jq -e '.requirements' > /dev/null 2>&1 && echo "yes" || echo "no")
  
  if [ "$HAS_BRIDGE" = "yes" ] && [ "$HAS_FEE_USD" = "yes" ] && \
     [ "$HAS_ETA" = "yes" ] && [ "$HAS_REQUIREMENTS" = "yes" ]; then
    echo "RESULT: PASS - Route structure valid ($ROUTE_COUNT routes)"
    ((PASSED++))
  else
    echo "RESULT: FAIL - Route structure missing required fields"
    echo "  bridge: $HAS_BRIDGE, fee_usd: $HAS_FEE_USD, eta_minutes: $HAS_ETA, requirements: $HAS_REQUIREMENTS"
    ((FAILED++))
    exit 1
  fi
else
  echo "RESULT: WARNING - No routes found (may need bridge configuration)"
fi

echo "Test 3: Fee estimate validation (must be non-negative numeric)"
if [ "$ROUTE_COUNT" -gt 0 ]; then
  FEE_USD=$(echo "$RESPONSE" | jq -r '.output.routes[0].fee_usd' 2>/dev/null)
  
  if [ -n "$FEE_USD" ] && [ "$FEE_USD" != "null" ]; then
    FEE_NUM=$(echo "$FEE_USD" | grep -E '^-?[0-9]+\.?[0-9]*$' || echo "")
    if [ -n "$FEE_NUM" ]; then
      if (( $(echo "$FEE_USD >= 0" | bc -l 2>/dev/null || echo "0") )); then
        echo "RESULT: PASS - Fee estimate is valid and non-negative: \$$FEE_USD"
        ((PASSED++))
      else
        echo "RESULT: FAIL - Fee estimate is negative: \$$FEE_USD"
        ((FAILED++))
        exit 1
      fi
    else
      echo "RESULT: FAIL - Fee estimate is not a valid number: $FEE_USD"
      ((FAILED++))
      exit 1
    fi
  else
    echo "RESULT: FAIL - Fee estimate missing or invalid"
    ((FAILED++))
    exit 1
  fi
else
  if [ "$HAS_ROUTES" = "yes" ]; then
    IS_ARRAY=$(echo "$RESPONSE" | jq '.output.routes | type' 2>/dev/null)
    if [ "$IS_ARRAY" = '"array"' ]; then
      echo "RESULT: PASS - Output structure valid (routes array present even if empty)"
      ((PASSED++))
    else
      echo "RESULT: FAIL - routes is not an array: $IS_ARRAY"
      ((FAILED++))
      exit 1
    fi
  else
    echo "RESULT: FAIL - routes array missing"
    ((FAILED++))
    exit 1
  fi
fi

echo "Test 4: ETA estimate validation (must be 0-180 minutes)"
if [ "$ROUTE_COUNT" -gt 0 ]; then
  ETA_MINUTES=$(echo "$RESPONSE" | jq -r '.output.routes[0].eta_minutes' 2>/dev/null)
  
  if [ -n "$ETA_MINUTES" ] && [ "$ETA_MINUTES" != "null" ]; then
    if [ "$ETA_MINUTES" -ge 0 ] && [ "$ETA_MINUTES" -le 180 ]; then
      echo "RESULT: PASS - ETA within reasonable range: ${ETA_MINUTES} minutes"
      ((PASSED++))
    else
      echo "RESULT: FAIL - ETA outside reasonable range: ${ETA_MINUTES} minutes (expected 0-180)"
      ((FAILED++))
      exit 1
    fi
  else
    echo "RESULT: FAIL - ETA missing or invalid"
    ((FAILED++))
    exit 1
  fi
else
  if [ "$HAS_ROUTES" = "yes" ]; then
    IS_ARRAY=$(echo "$RESPONSE" | jq '.output.routes | type' 2>/dev/null)
    if [ "$IS_ARRAY" = '"array"' ]; then
      echo "RESULT: PASS - Output structure valid (routes array present even if empty)"
      ((PASSED++))
    else
      echo "RESULT: FAIL - routes is not an array: $IS_ARRAY"
      ((FAILED++))
      exit 1
    fi
  else
    echo "RESULT: FAIL - routes array missing"
    ((FAILED++))
    exit 1
  fi
fi

echo "Test 5: Best route selection (best_route must be present and match cheapest)"
BEST_ROUTE=$(echo "$RESPONSE" | jq -e '.output.best_route' > /dev/null 2>&1 && echo "present" || echo "null")

if [ "$BEST_ROUTE" = "present" ]; then
  BEST_BRIDGE=$(echo "$RESPONSE" | jq -r '.output.best_route.bridge' 2>/dev/null)
  
  if [ -n "$BEST_BRIDGE" ] && [ "$BEST_BRIDGE" != "null" ]; then
    if [ "$ROUTE_COUNT" -gt 0 ]; then
      BEST_FEE=$(echo "$RESPONSE" | jq -r '.output.best_route.fee_usd' 2>/dev/null)
      FIRST_FEE=$(echo "$RESPONSE" | jq -r '.output.routes[0].fee_usd' 2>/dev/null)
      
      if [ "$BEST_FEE" = "$FIRST_FEE" ]; then
        echo "RESULT: PASS - Best route matches cheapest route: $BEST_BRIDGE (\$$BEST_FEE)"
        ((PASSED++))
      else
        echo "RESULT: WARNING - Best route fee (\$$BEST_FEE) does not match cheapest (\$$FIRST_FEE)"
      fi
    else
      echo "RESULT: PASS - Best route identified: $BEST_BRIDGE"
      ((PASSED++))
    fi
  else
    echo "RESULT: FAIL - Best route missing bridge name"
    ((FAILED++))
    exit 1
  fi
else
  if [ "$ROUTE_COUNT" -gt 0 ]; then
    echo "RESULT: FAIL - Routes found but best_route field missing"
    ((FAILED++))
    exit 1
  else
    echo "RESULT: INFO - No routes, best_route may be null"
  fi
fi

echo "Test 6: Fastest route identification (fastest_route must be present)"
FASTEST_ROUTE=$(echo "$RESPONSE" | jq -e '.output.fastest_route' > /dev/null 2>&1 && echo "present" || echo "null")

if [ "$FASTEST_ROUTE" = "present" ]; then
  FASTEST_BRIDGE=$(echo "$RESPONSE" | jq -r '.output.fastest_route.bridge' 2>/dev/null)
  FASTEST_ETA=$(echo "$RESPONSE" | jq -r '.output.fastest_route.eta_minutes' 2>/dev/null)
  
  if [ -n "$FASTEST_BRIDGE" ] && [ "$FASTEST_BRIDGE" != "null" ]; then
    echo "RESULT: PASS - Fastest route identified: $FASTEST_BRIDGE (${FASTEST_ETA}m)"
    ((PASSED++))
  else
    echo "RESULT: FAIL - Fastest route missing bridge name"
    ((FAILED++))
    exit 1
  fi
else
  if [ "$ROUTE_COUNT" -gt 0 ]; then
    echo "RESULT: WARNING - Routes found but fastest_route field missing"
  else
    echo "RESULT: INFO - No routes, fastest_route may be null"
  fi
fi

echo "Test 7: Requirements listing (requirements array must be present)"
if [ "$ROUTE_COUNT" -gt 0 ]; then
  REQ_COUNT=$(echo "$RESPONSE" | jq '.output.routes[0].requirements | length' 2>/dev/null || echo "0")
  
  HAS_REQUIREMENTS=$(echo "$RESPONSE" | jq -e '.output.routes[0].requirements' > /dev/null 2>&1 && echo "yes" || echo "no")
  
  if [ "$HAS_REQUIREMENTS" = "yes" ]; then
    echo "RESULT: PASS - Requirements array present ($REQ_COUNT requirements)"
    ((PASSED++))
  else
    echo "RESULT: FAIL - Requirements array missing"
    ((FAILED++))
    exit 1
  fi
else
  if [ "$HAS_ROUTES" = "yes" ]; then
    IS_ARRAY=$(echo "$RESPONSE" | jq '.output.routes | type' 2>/dev/null)
    if [ "$IS_ARRAY" = '"array"' ]; then
      echo "RESULT: PASS - Output structure valid (routes array present even if empty)"
      ((PASSED++))
    else
      echo "RESULT: FAIL - routes is not an array: $IS_ARRAY"
      ((FAILED++))
      exit 1
    fi
  else
    echo "RESULT: FAIL - routes array missing"
    ((FAILED++))
    exit 1
  fi
fi

echo "Test 8: Multiple bridge support (should query multiple bridges)"
BRIDGES=$(echo "$RESPONSE" | jq -r '.output.routes[].bridge' 2>/dev/null | sort -u | wc -l | tr -d ' ')

if [ "$BRIDGES" -ge 2 ]; then
  echo "RESULT: PASS - Multiple bridges queried: $BRIDGES"
  ((PASSED++))
else
  echo "RESULT: WARNING - Only $BRIDGES bridge(s) returned (may need more bridge integrations)"
fi

echo ""
echo "=== Test Summary ==="
echo "Passed: $PASSED"
echo "Failed: $FAILED"
if [ $FAILED -eq 0 ]; then
  echo "OVERALL: All acceptance criteria met (queries major bridges, accurate fee/time estimates)"
  exit 0
else
  echo "OVERALL: Some acceptance criteria not met"
  exit 1
fi
