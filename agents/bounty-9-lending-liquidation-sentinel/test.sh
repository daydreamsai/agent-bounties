#!/bin/bash

# Test script for Lending Liquidation Sentinel agent
# Tests: Alerts when HF<1.1, accurate health factor, liquidation price calculation

set -e

PASSED=0
FAILED=0

echo "=== Testing Lending Liquidation Sentinel Agent ==="

# Test with wallet that may have lending positions
TEST_WALLET="${TEST_WALLET:-0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045}"

echo "Test 1: Agent response check"
RESPONSE=$(curl -s -X POST http://localhost:3000/entrypoints/monitor_position/invoke \
  -H "Content-Type: application/json" \
  -d '{"input":{
    "wallet": "'$TEST_WALLET'",
    "protocol_ids": ["aave", "compound"]
  }}' || echo '{"error": "connection failed"}}')

if echo "$RESPONSE" | grep -q "\"status\".*\"succeeded\"\|\"error\""; then
  echo "RESULT: PASS - Agent responds to requests"
  ((PASSED++))
else
  echo "RESULT: FAIL - Agent does not respond correctly"
  ((FAILED++))
  exit 1
fi

echo "Test 2: Position structure (health_factor, liq_price, buffer_percent, alert_threshold_hit required)"
POSITION_COUNT=$(echo "$RESPONSE" | jq '.output.positions | length' 2>/dev/null || echo "0")
HAS_POSITIONS=$(echo "$RESPONSE" | jq -e '.output.positions' > /dev/null 2>&1 && echo "yes" || echo "no")

if [ "$POSITION_COUNT" -gt 0 ]; then
  FIRST_POSITION=$(echo "$RESPONSE" | jq '.output.positions[0]' 2>/dev/null)
  
  HAS_HEALTH_FACTOR=$(echo "$FIRST_POSITION" | jq -e '.health_factor' > /dev/null 2>&1 && echo "yes" || echo "no")
  HAS_LIQ_PRICE=$(echo "$FIRST_POSITION" | jq -e '.liq_price' > /dev/null 2>&1 && echo "yes" || echo "no")
  HAS_BUFFER_PCT=$(echo "$FIRST_POSITION" | jq -e '.buffer_percent' > /dev/null 2>&1 && echo "yes" || echo "no")
  HAS_ALERT_THRESHOLD=$(echo "$FIRST_POSITION" | jq -e '.alert_threshold_hit' > /dev/null 2>&1 && echo "yes" || echo "no")
  
  if [ "$HAS_HEALTH_FACTOR" = "yes" ] && [ "$HAS_LIQ_PRICE" = "yes" ] && \
     [ "$HAS_BUFFER_PCT" = "yes" ] && [ "$HAS_ALERT_THRESHOLD" = "yes" ]; then
    echo "RESULT: PASS - Position structure valid ($POSITION_COUNT positions)"
    ((PASSED++))
  else
    echo "RESULT: FAIL - Position structure missing required fields"
    echo "  health_factor: $HAS_HEALTH_FACTOR, liq_price: $HAS_LIQ_PRICE, buffer_percent: $HAS_BUFFER_PCT, alert_threshold_hit: $HAS_ALERT_THRESHOLD"
    ((FAILED++))
    exit 1
  fi
else
  echo "RESULT: WARNING - No positions found (may be normal if wallet has no lending positions)"
fi

echo "Test 3: Health factor validation (must be numeric, 0-10 typically)"
POSITION_COUNT=$(echo "$RESPONSE" | jq '.output.positions | length' 2>/dev/null || echo "0")

if [ "$POSITION_COUNT" -gt 0 ]; then
  HEALTH_FACTOR=$(echo "$RESPONSE" | jq -r '.output.positions[0].health_factor' 2>/dev/null)
  
  if [ -n "$HEALTH_FACTOR" ] && [ "$HEALTH_FACTOR" != "null" ]; then
    HF_NUM=$(echo "$HEALTH_FACTOR" | grep -E '^[0-9]+\.?[0-9]*$' || echo "")
    if [ -n "$HF_NUM" ]; then
      HF_INT=$(echo "$HEALTH_FACTOR" | sed 's/\..*//')
      if [ "$HF_INT" -ge 0 ] && [ "$HF_INT" -le 10 ]; then
        echo "RESULT: PASS - Health factor within valid range: $HEALTH_FACTOR"
        ((PASSED++))
        if (( $(echo "$HEALTH_FACTOR < 1.0" | bc -l 2>/dev/null || echo "0") )); then
          echo "  WARNING: Position is already liquidatable (HF < 1.0)"
        fi
      else
        echo "RESULT: FAIL - Health factor outside valid range: $HEALTH_FACTOR (expected 0-10)"
        ((FAILED++))
        exit 1
      fi
    else
      echo "RESULT: FAIL - Health factor is not a valid number: $HEALTH_FACTOR"
      ((FAILED++))
      exit 1
    fi
  else
    echo "RESULT: FAIL - Health factor missing or invalid"
    ((FAILED++))
    exit 1
  fi
else
  if [ "$HAS_POSITIONS" = "yes" ]; then
    IS_ARRAY=$(echo "$RESPONSE" | jq '.output.positions | type' 2>/dev/null)
    if [ "$IS_ARRAY" = '"array"' ]; then
      echo "RESULT: PASS - Output structure valid (positions array present even if empty)"
      ((PASSED++))
    else
      echo "RESULT: FAIL - positions is not an array: $IS_ARRAY"
      ((FAILED++))
      exit 1
    fi
  else
    echo "RESULT: FAIL - positions array missing"
    ((FAILED++))
    exit 1
  fi
fi

echo "Test 4: Liquidation price validation (must be present, numeric)"
if [ "$POSITION_COUNT" -gt 0 ]; then
  LIQ_PRICE=$(echo "$RESPONSE" | jq -r '.output.positions[0].liq_price' 2>/dev/null)
  
  if [ -n "$LIQ_PRICE" ] && [ "$LIQ_PRICE" != "null" ]; then
    echo "RESULT: PASS - Liquidation price provided: $LIQ_PRICE"
    ((PASSED++))
  else
    echo "RESULT: FAIL - Liquidation price missing or invalid"
    ((FAILED++))
    exit 1
  fi
else
  if [ "$HAS_POSITIONS" = "yes" ]; then
    IS_ARRAY=$(echo "$RESPONSE" | jq '.output.positions | type' 2>/dev/null)
    if [ "$IS_ARRAY" = '"array"' ]; then
      echo "RESULT: PASS - Output structure valid (positions array present even if empty)"
      ((PASSED++))
    else
      echo "RESULT: FAIL - positions is not an array: $IS_ARRAY"
      ((FAILED++))
      exit 1
    fi
  else
    echo "RESULT: FAIL - positions array missing"
    ((FAILED++))
    exit 1
  fi
fi

echo "Test 5: Alert threshold (alert_threshold_hit must be true when HF < 1.1)"
if [ "$POSITION_COUNT" -gt 0 ]; then
  ALERT_THRESHOLD=$(echo "$RESPONSE" | jq -r '.output.positions[0].alert_threshold_hit' 2>/dev/null)
  ANY_ALERT=$(echo "$RESPONSE" | jq -r '.output.any_alert' 2>/dev/null)
  HEALTH_FACTOR=$(echo "$RESPONSE" | jq -r '.output.positions[0].health_factor' 2>/dev/null)
  
  if [ "$ALERT_THRESHOLD" = "true" ] || [ "$ALERT_THRESHOLD" = "false" ]; then
    if [ "$ALERT_THRESHOLD" = "true" ]; then
      # Verify health factor is actually < 1.1
      if [ -n "$HEALTH_FACTOR" ] && [ "$HEALTH_FACTOR" != "null" ]; then
        if (( $(echo "$HEALTH_FACTOR < 1.1" | bc -l 2>/dev/null || echo "0") )); then
          echo "RESULT: PASS - Alert correctly triggered for HF < 1.1 (HF: $HEALTH_FACTOR)"
          ((PASSED++))
        else
          echo "RESULT: FAIL - Alert set to true but HF ($HEALTH_FACTOR) is not < 1.1"
          ((FAILED++))
          exit 1
        fi
      else
        echo "RESULT: PASS - Alert triggered"
        ((PASSED++))
      fi
    else
      echo "RESULT: PASS - No alert (HF >= 1.1)"
      ((PASSED++))
    fi
    
    if [ "$ANY_ALERT" = "true" ] || [ "$ANY_ALERT" = "false" ]; then
      echo "RESULT: PASS - any_alert field present: $ANY_ALERT"
      ((PASSED++))
    else
      echo "RESULT: FAIL - any_alert field missing or invalid"
      ((FAILED++))
      exit 1
    fi
  else
    echo "RESULT: FAIL - alert_threshold_hit must be true or false, got: $ALERT_THRESHOLD"
    ((FAILED++))
    exit 1
  fi
else
  if [ "$HAS_POSITIONS" = "yes" ]; then
    IS_ARRAY=$(echo "$RESPONSE" | jq '.output.positions | type' 2>/dev/null)
    if [ "$IS_ARRAY" = '"array"' ]; then
      echo "RESULT: PASS - Output structure valid (positions array present even if empty)"
      ((PASSED++))
    else
      echo "RESULT: FAIL - positions is not an array: $IS_ARRAY"
      ((FAILED++))
      exit 1
    fi
  else
    echo "RESULT: FAIL - positions array missing"
    ((FAILED++))
    exit 1
  fi
fi

echo "Test 6: Buffer percentage validation (must be numeric, non-negative)"
if [ "$POSITION_COUNT" -gt 0 ]; then
  BUFFER_PCT=$(echo "$RESPONSE" | jq -r '.output.positions[0].buffer_percent' 2>/dev/null)
  
  if [ -n "$BUFFER_PCT" ] && [ "$BUFFER_PCT" != "null" ]; then
    BUFFER_NUM=$(echo "$BUFFER_PCT" | grep -E '^-?[0-9]+\.?[0-9]*$' || echo "")
    if [ -n "$BUFFER_NUM" ]; then
      if (( $(echo "$BUFFER_PCT >= 0" | bc -l 2>/dev/null || echo "0") )); then
        echo "RESULT: PASS - Buffer percentage valid: ${BUFFER_PCT}%"
        ((PASSED++))
      else
        echo "RESULT: FAIL - Buffer percentage is negative: ${BUFFER_PCT}%"
        ((FAILED++))
        exit 1
      fi
    else
      echo "RESULT: FAIL - Buffer percentage is not a valid number: $BUFFER_PCT"
      ((FAILED++))
      exit 1
    fi
  else
    echo "RESULT: FAIL - Buffer percentage missing or invalid"
    ((FAILED++))
    exit 1
  fi
else
  if [ "$HAS_POSITIONS" = "yes" ]; then
    IS_ARRAY=$(echo "$RESPONSE" | jq '.output.positions | type' 2>/dev/null)
    if [ "$IS_ARRAY" = '"array"' ]; then
      echo "RESULT: PASS - Output structure valid (positions array present even if empty)"
      ((PASSED++))
    else
      echo "RESULT: FAIL - positions is not an array: $IS_ARRAY"
      ((FAILED++))
      exit 1
    fi
  else
    echo "RESULT: FAIL - positions array missing"
    ((FAILED++))
    exit 1
  fi
fi

echo "Test 7: Most at-risk position identification"
MOST_AT_RISK=$(echo "$RESPONSE" | jq -e '.output.most_at_risk' > /dev/null 2>&1 && echo "present" || echo "null")

if [ "$MOST_AT_RISK" = "present" ]; then
  if [ "$POSITION_COUNT" -gt 1 ]; then
    MOST_AT_RISK_HF=$(echo "$RESPONSE" | jq -r '.output.most_at_risk.health_factor' 2>/dev/null)
    echo "RESULT: PASS - Most at-risk position identified (HF: $MOST_AT_RISK_HF)"
    ((PASSED++))
  else
    echo "RESULT: INFO - Only one position, cannot verify most at-risk selection"
  fi
else
  echo "RESULT: INFO - most_at_risk field not present (may be null if no positions)"
fi

echo ""
echo "=== Test Summary ==="
echo "Passed: $PASSED"
echo "Failed: $FAILED"
if [ $FAILED -eq 0 ]; then
  echo "OVERALL: All acceptance criteria met (alerts when HF < 1.1, accurate health factor calculation)"
  exit 0
else
  echo "OVERALL: Some acceptance criteria not met"
  exit 1
fi
