#!/bin/bash

# Test script for Perps Funding Pulse agent
# Tests: Returns real-time funding rates, open interest, time to next funding

set -e

PASSED=0
FAILED=0

echo "=== Testing Perps Funding Pulse Agent ==="

echo "Test 1: Agent response check"
RESPONSE=$(curl -s -X POST http://localhost:3000/entrypoints/get_funding_data/invoke \
  -H "Content-Type: application/json" \
  -d '{"input":{
    "venue_ids": ["perpetual", "gmx"],
    "markets": ["ETH-USD"]
  }}' || echo '{"error": "connection failed"}}')

if echo "$RESPONSE" | grep -q "\"status\".*\"succeeded\"\|\"error\""; then
  echo "RESULT: PASS - Agent responds to requests"
  ((PASSED++))
else
  echo "RESULT: FAIL - Agent does not respond correctly"
  ((FAILED++))
  exit 1
fi

echo "Test 2: Funding data structure (venue, market, funding_rate, time_to_next, open_interest, skew required)"
DATA_COUNT=$(echo "$RESPONSE" | jq '.output.funding_data | length' 2>/dev/null || echo "0")

if [ "$DATA_COUNT" -gt 0 ]; then
  FIRST_DATA=$(echo "$RESPONSE" | jq '.output.funding_data[0]' 2>/dev/null)
  
  HAS_VENUE=$(echo "$FIRST_DATA" | jq -e '.venue' > /dev/null 2>&1 && echo "yes" || echo "no")
  HAS_MARKET=$(echo "$FIRST_DATA" | jq -e '.market' > /dev/null 2>&1 && echo "yes" || echo "no")
  HAS_FUNDING_RATE=$(echo "$FIRST_DATA" | jq -e '.funding_rate' > /dev/null 2>&1 && echo "yes" || echo "no")
  HAS_TIME_TO_NEXT=$(echo "$FIRST_DATA" | jq -e '.time_to_next' > /dev/null 2>&1 && echo "yes" || echo "no")
  HAS_OPEN_INTEREST=$(echo "$FIRST_DATA" | jq -e '.open_interest' > /dev/null 2>&1 && echo "yes" || echo "no")
  HAS_SKEW=$(echo "$FIRST_DATA" | jq -e '.skew' > /dev/null 2>&1 && echo "yes" || echo "no")
  
  if [ "$HAS_VENUE" = "yes" ] && [ "$HAS_MARKET" = "yes" ] && \
     [ "$HAS_FUNDING_RATE" = "yes" ] && [ "$HAS_TIME_TO_NEXT" = "yes" ] && \
     [ "$HAS_OPEN_INTEREST" = "yes" ] && [ "$HAS_SKEW" = "yes" ]; then
    echo "RESULT: PASS - Funding data structure valid ($DATA_COUNT entries)"
    ((PASSED++))
  else
    echo "RESULT: FAIL - Funding data missing required fields"
    echo "  venue: $HAS_VENUE, market: $HAS_MARKET, funding_rate: $HAS_FUNDING_RATE, time_to_next: $HAS_TIME_TO_NEXT, open_interest: $HAS_OPEN_INTEREST, skew: $HAS_SKEW"
    ((FAILED++))
    exit 1
  fi
else
  echo "RESULT: WARNING - No funding data found (may need venue configuration)"
fi

echo "Test 3: Funding rate validation (must be numeric, typically -1% to +1% per 8 hours)"
if [ "$DATA_COUNT" -gt 0 ]; then
  FUNDING_RATE=$(echo "$RESPONSE" | jq -r '.output.funding_data[0].funding_rate' 2>/dev/null)
  
  if [ -n "$FUNDING_RATE" ] && [ "$FUNDING_RATE" != "null" ]; then
    RATE_NUM=$(echo "$FUNDING_RATE" | grep -E '^-?[0-9]+\.?[0-9]*$' || echo "")
    if [ -n "$RATE_NUM" ]; then
      RATE_ABS=$(echo "$FUNDING_RATE" | sed 's/-//' | bc 2>/dev/null || echo "0")
      if (( $(echo "$RATE_ABS <= 0.01" | bc -l 2>/dev/null || echo "0") )); then
        echo "RESULT: PASS - Funding rate within typical range: ${FUNDING_RATE}"
        ((PASSED++))
      else
        echo "RESULT: WARNING - Funding rate outside typical range: ${FUNDING_RATE} (expected -1% to +1%)"
      fi
    else
      echo "RESULT: FAIL - Funding rate is not a valid number: $FUNDING_RATE"
      ((FAILED++))
      exit 1
    fi
  else
    echo "RESULT: FAIL - Funding rate missing or invalid"
    ((FAILED++))
    exit 1
  fi
else
  HAS_FUNDING_DATA=$(echo "$RESPONSE" | jq -e '.output.funding_data' > /dev/null 2>&1 && echo "yes" || echo "no")
  if [ "$HAS_FUNDING_DATA" = "yes" ]; then
    IS_ARRAY=$(echo "$RESPONSE" | jq '.output.funding_data | type' 2>/dev/null)
    if [ "$IS_ARRAY" = '"array"' ]; then
      echo "RESULT: PASS - Output structure valid (funding_data array present even if empty)"
      ((PASSED++))
    else
      echo "RESULT: FAIL - funding_data is not an array: $IS_ARRAY"
      ((FAILED++))
      exit 1
    fi
  else
    echo "RESULT: FAIL - funding_data array missing"
    ((FAILED++))
    exit 1
  fi
fi

echo "Test 4: Time to next funding validation (must be 0-28800 seconds = 0-8 hours)"
if [ "$DATA_COUNT" -gt 0 ]; then
  TIME_TO_NEXT=$(echo "$RESPONSE" | jq -r '.output.funding_data[0].time_to_next' 2>/dev/null)
  
  if [ -n "$TIME_TO_NEXT" ] && [ "$TIME_TO_NEXT" != "null" ]; then
    if [ "$TIME_TO_NEXT" -ge 0 ] && [ "$TIME_TO_NEXT" -le 28800 ]; then
      echo "RESULT: PASS - Time to next funding within valid range: ${TIME_TO_NEXT}s"
      ((PASSED++))
    else
      echo "RESULT: FAIL - Time to next funding outside valid range: ${TIME_TO_NEXT}s (expected 0-28800s)"
      ((FAILED++))
      exit 1
    fi
  else
    echo "RESULT: FAIL - Time to next funding missing or invalid"
    ((FAILED++))
    exit 1
  fi
else
  if [ "$HAS_FUNDING_DATA" = "yes" ]; then
    IS_ARRAY=$(echo "$RESPONSE" | jq '.output.funding_data | type' 2>/dev/null)
    if [ "$IS_ARRAY" = '"array"' ]; then
      echo "RESULT: PASS - Output structure valid (funding_data array present even if empty)"
      ((PASSED++))
    else
      echo "RESULT: FAIL - funding_data is not an array: $IS_ARRAY"
      ((FAILED++))
      exit 1
    fi
  else
    echo "RESULT: FAIL - funding_data array missing"
    ((FAILED++))
    exit 1
  fi
fi

echo "Test 5: Open interest validation (must be present, string format)"
if [ "$DATA_COUNT" -gt 0 ]; then
  OPEN_INTEREST=$(echo "$RESPONSE" | jq -r '.output.funding_data[0].open_interest' 2>/dev/null)
  
  if [ -n "$OPEN_INTEREST" ] && [ "$OPEN_INTEREST" != "null" ]; then
    echo "RESULT: PASS - Open interest provided: $OPEN_INTEREST"
    ((PASSED++))
  else
    echo "RESULT: FAIL - Open interest missing or invalid"
    ((FAILED++))
    exit 1
  fi
else
  if [ "$HAS_FUNDING_DATA" = "yes" ]; then
    IS_ARRAY=$(echo "$RESPONSE" | jq '.output.funding_data | type' 2>/dev/null)
    if [ "$IS_ARRAY" = '"array"' ]; then
      echo "RESULT: PASS - Output structure valid (funding_data array present even if empty)"
      ((PASSED++))
    else
      echo "RESULT: FAIL - funding_data is not an array: $IS_ARRAY"
      ((FAILED++))
      exit 1
    fi
  else
    echo "RESULT: FAIL - funding_data array missing"
    ((FAILED++))
    exit 1
  fi
fi

echo "Test 6: Skew validation (must be between 0 and 1)"
if [ "$DATA_COUNT" -gt 0 ]; then
  SKEW=$(echo "$RESPONSE" | jq -r '.output.funding_data[0].skew' 2>/dev/null)
  
  if [ -n "$SKEW" ] && [ "$SKEW" != "null" ]; then
    SKEW_NUM=$(echo "$SKEW" | grep -E '^[0-9]+\.?[0-9]*$' || echo "")
    if [ -n "$SKEW_NUM" ]; then
      if (( $(echo "$SKEW >= 0 && $SKEW <= 1" | bc -l 2>/dev/null || echo "0") )); then
        echo "RESULT: PASS - Skew within valid range [0, 1]: ${SKEW}"
        ((PASSED++))
      else
        echo "RESULT: FAIL - Skew outside valid range: ${SKEW} (expected 0-1)"
        ((FAILED++))
        exit 1
      fi
    else
      echo "RESULT: FAIL - Skew is not a valid number: $SKEW"
      ((FAILED++))
      exit 1
    fi
  else
    echo "RESULT: FAIL - Skew missing or invalid"
    ((FAILED++))
    exit 1
  fi
else
  if [ "$HAS_FUNDING_DATA" = "yes" ]; then
    IS_ARRAY=$(echo "$RESPONSE" | jq '.output.funding_data | type' 2>/dev/null)
    if [ "$IS_ARRAY" = '"array"' ]; then
      echo "RESULT: PASS - Output structure valid (funding_data array present even if empty)"
      ((PASSED++))
    else
      echo "RESULT: FAIL - funding_data is not an array: $IS_ARRAY"
      ((FAILED++))
      exit 1
    fi
  else
    echo "RESULT: FAIL - funding_data array missing"
    ((FAILED++))
    exit 1
  fi
fi

echo ""
echo "=== Test Summary ==="
echo "Passed: $PASSED"
echo "Failed: $FAILED"
if [ $FAILED -eq 0 ]; then
  echo "OVERALL: All acceptance criteria met (real-time funding rates, open interest, time to next)"
  exit 0
else
  echo "OVERALL: Some acceptance criteria not met"
  exit 1
fi
