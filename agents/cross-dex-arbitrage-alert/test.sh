#!/bin/bash
# Test the Cross DEX Arbitrage Alert agent
BASE_URL="${1:-http://localhost:3000}"

echo "=== Test 1: scan_named — WETH→USDC on Base ==="
curl -s -X POST "$BASE_URL/scan_named" \
  -H "Content-Type: application/json" \
  -d '{"token_in":"WETH","token_out":"USDC","amount":"10","chains":[8453]}' | jq .

echo ""
echo "=== Test 2: scan — Raw addresses on Base ==="
curl -s -X POST "$BASE_URL/scan" \
  -H "Content-Type: application/json" \
  -d '{"token_in":"0x4200000000000000000000000000000000000006","token_out":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","amount_in":"10000000000000000000","chains":[8453],"token_out_decimals":6}' | jq .

echo ""
echo "=== Test 3: triangular_scan — WETH→USDC→cbBTC→WETH ==="
curl -s -X POST "$BASE_URL/triangular_scan" \
  -H "Content-Type: application/json" \
  -d '{"token_a":"WETH","token_b":"USDC","token_c":"cbBTC","amount":"10","chain":8453}' | jq .
