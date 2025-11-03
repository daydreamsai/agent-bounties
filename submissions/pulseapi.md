# PulseAPI - Multi-Source Data Aggregation Service

## Agent Description

**PulseAPI** is a production-ready, multi-source data aggregation service built for the x402 ecosystem. It provides AI agents with real-time cryptocurrency prices, news, weather, market sentiment, and analytics through 7 powerful endpoints with automatic USDC micropayments on Base.

### Key Features

- **7 Production Endpoints:** Crypto prices, news, weather, multi-data combo, market sentiment, analytics, and historical data
- **Multi-Source Aggregation:** Combines data from CoinGecko, CoinCap, CryptoCompare, and Open-Meteo for reliability
- **Pay-Per-Use Pricing:** $0.01 - $0.06 per query with 17% savings on combo endpoint
- **AI-Optimized:** Built specifically for AI agents with natural language friendly inputs
- **MCP Compatible:** Published npm package for Claude Desktop integration
- **Production-Ready:** 122 passing tests, comprehensive error handling, fallback APIs

### Technical Stack

- **Runtime:** Bun
- **Framework:** Hono with @lucid-dreams/agent-kit
- **Payment:** x402 protocol with USDC on Base
- **Validation:** TypeScript + Zod schemas
- **Deployment:** Railway (auto-scaling)

---

## Live Link

**Deployment URL:** https://pulseapi-production-00cc.up.railway.app

**x402scan Registry:** https://www.x402scan.com/resources

**x402scan Service Page:** https://www.x402scan.com/server/134b6de2-0d0f-48e7-ae4e-c5e343b88e65/

### Verification

The x402scan service page shows PulseAPI is fully functional with:
- ✅ All 7 endpoints registered and discoverable
- ✅ Organization: "Daydreams" (properly attributed to ecosystem)
- ✅ Author: "DegenLlama.net"
- ✅ Complete input schemas for each endpoint
- ✅ Proper pricing display ($0.01 - $0.06 per query)

### Test Endpoints

```bash
# Crypto Prices ($0.02)
curl -i https://pulseapi-production-00cc.up.railway.app/entrypoints/crypto-price/invoke

# Multi-Data Combo ($0.05)
curl -i https://pulseapi-production-00cc.up.railway.app/entrypoints/multi-data/invoke

# Market Sentiment ($0.06)
curl -i https://pulseapi-production-00cc.up.railway.app/entrypoints/market-sentiment/invoke
```

All endpoints return HTTP 402 (Payment Required) with proper x402 headers.

---

## Acceptance Criteria

**Note:** This is a general x402 ecosystem contribution, not tied to a specific bounty issue.

- [x] Deployed on a domain (Railway)
- [x] Reachable via x402 protocol
- [x] All 7 endpoints tested and working
- [x] Registered on x402scan
- [x] Comprehensive documentation
- [x] Production-ready with 122 passing tests
- [x] MCP server published on npm

---

## Other Resources

- **Repository:** https://github.com/DeganAI/pulseapi
- **API Documentation:** [API_DOCS.md](https://github.com/DeganAI/pulseapi/blob/main/API_DOCS.md)
- **Test Results:** [TEST_SUMMARY.md](https://github.com/DeganAI/pulseapi/blob/main/TEST_SUMMARY.md)
- **Deployment Guide:** [DEPLOYMENT.md](https://github.com/DeganAI/pulseapi/blob/main/DEPLOYMENT.md)
- **Full Submission:** [BOUNTY_SUBMISSION.md](https://github.com/DeganAI/pulseapi/blob/main/BOUNTY_SUBMISSION.md)
- **npm Package:** [@hashmonkey/mcp-server-pulseapi](https://www.npmjs.com/package/@hashmonkey/mcp-server-pulseapi)

### Available Endpoints

1. **Crypto Prices** ($0.02) - Real-time prices for 1000+ cryptocurrencies
2. **News** ($0.03) - Crypto news with AI sentiment analysis
3. **Weather** ($0.01) - Real-time weather + 5-day forecasts
4. **Multi-Data** ($0.05) - Combo endpoint saving 17%
5. **Market Sentiment** ($0.06) - AI-powered trading signals
6. **Analytics** ($0.01) - Usage tracking & observability
7. **Historical Data** ($0.04) - Time-series analysis with insights

---

## Solana Wallet

**Wallet Address:** Hnf7qnwdHYtSqj7PjjLjokUq4qaHR4qtHLedW7XDaNDG

**Note:** While this submission doesn't match a specific bounty issue, it demonstrates a fully functional x402 service with real-world utility for AI agents.

---

## Additional Notes

### Impact Metrics

- **122 tests** passing (100% pass rate)
- **463 assertions** verified
- **9.7/10** data quality score from live API testing
- **< 2 second** average response time
- **99%+** uptime since deployment

### Why This Matters

PulseAPI solves critical pain points for AI agents:

1. **No API Key Hell:** x402 payments eliminate registration requirements
2. **Pay-Per-Use:** No monthly subscriptions, pay only for queries used
3. **Multi-Source Reliability:** Automatic fallback between APIs ensures high uptime
4. **Combo Pricing:** Multi-data endpoint saves 17% vs individual calls
5. **MCP Native:** Zero-friction distribution via Claude Desktop

### Ecosystem Contribution

- All 7 endpoints registered on x402scan for discoverability
- MCP server published on npm for easy integration
- MIT licensed and open source
- Complete documentation for developers
- Active maintenance commitment

### Competitive Advantages

| Feature | PulseAPI | Traditional APIs |
|---------|----------|------------------|
| API Keys | None needed | Required |
| Payment | USDC micropayments | Credit card/invoices |
| Pricing | $0.01-$0.06 per query | $50-500/month |
| Setup Time | Instant | Hours/days |
| For AI Agents | Optimized | Requires wrapper |

---

**Built by [DegenLlama.net](https://degenllama.net)**

Thank you for considering PulseAPI as a contribution to the x402 ecosystem!
