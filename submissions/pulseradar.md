# PulseRadar - Endpoint Discovery and Trust Scoring for x402

## Agent Description

**PulseRadar** is the first dedicated endpoint discovery and trust scoring service for the x402 ecosystem. It solves a critical problem: how do developers and AI agents know which x402 services are reliable, available, and trustworthy?

### The Problem

The x402 payment protocol is growing rapidly, but discovering and evaluating reliable endpoints is challenging. Without visibility into which services are actually working, users and agents are left guessing - wasting time and money on unreliable services.

### The Solution

PulseRadar provides **24/7 automated monitoring** with:

- **Continuous Discovery** - Automatically finds and tracks new x402 services
- **Regular Health Checks** - Real tests measuring response times and success rates
- **Historical Tracking** - Performance data over time, not just snapshots
- **Trust Scoring** - Grades A-F based on actual reliability, not self-reported claims
- **Live Verification** - Real-time endpoint testing on demand
- **Comparison Tools** - Side-by-side evaluation of multiple services

All data comes from **real testing**, not self-reported metrics. Trust scores update automatically as services improve or degrade.

### Key Features

- **Discover:** Browse all active x402 endpoints with trust scores
- **Trust Score:** Get detailed reliability metrics for any endpoint
- **Verify Live:** Run real-time health check on any service
- **Compare:** Evaluate 2-5 endpoints side-by-side to find the best option

### Technical Stack

- **Runtime:** Bun with Hono framework
- **Payment:** x402 protocol with USDC on Base ($0.50 flat rate)
- **Framework:** @lucid-dreams/agent-kit v0.2.24
- **Architecture:** Hybrid edge + serverless deployment
- **Monitoring:** 24/7 automated testing and discovery

---

## Live Link

**Deployment URL:** https://pulseradar-proxy-production.up.railway.app

**Manifest:** https://pulseradar-proxy-production.up.railway.app/.well-known/agent.json

**Documentation:** https://gist.github.com/HashMonkey710/eb7fbf8cdb67e3d94acd06f5a38e6bb3

### Verification

```bash
# View agent manifest
curl https://pulseradar-proxy-production.up.railway.app/.well-known/agent.json

# Test the invoke endpoint (requires x402 payment)
curl -i https://pulseradar-proxy-production.up.railway.app/entrypoints/pulseradar/invoke

# Discover endpoints example (returns 402 with payment info)
curl -X POST https://pulseradar-proxy-production.up.railway.app/entrypoints/pulseradar/invoke \
  -H "Content-Type: application/json" \
  -d '{"action": "discover", "limit": 10}'
```

Returns HTTP 402 (Payment Required) with proper x402 headers showing $0.50 USDC pricing.

---

## Acceptance Criteria

**Note:** This is an open scope x402 ecosystem contribution - infrastructure that benefits all agents and developers.

**Core Capabilities:**

- [x] **Endpoint Discovery**
  - Automatic detection of x402 services
  - Trust scoring with A-F grades
  - Historical performance tracking
  - Search and category filtering

- [x] **Trust Score Analysis**
  - Real-time reliability metrics
  - Uptime, speed, accuracy, and age scoring
  - Overall trust grade with recommendations
  - Historical test data and statistics

- [x] **Live Verification**
  - On-demand endpoint testing
  - Real response time measurement
  - Success/failure detection
  - Trust score calculation from live data

- [x] **Comparison Tool**
  - Side-by-side evaluation of 2-5 endpoints
  - Winner determination based on trust scores
  - Detailed metrics comparison
  - Clear recommendations

**General Requirements:**

- [x] Deployed on domain (Railway)
- [x] Reachable via x402 protocol
- [x] Complete agent manifest at /.well-known/agent.json
- [x] Working payment integration ($0.50 USDC on Base)
- [x] Single unified endpoint for all operations
- [x] Comprehensive API documentation

---

## Input Schema

### Single Unified Endpoint

All operations use one endpoint with an `action` parameter:

```typescript
{
  action: "discover" | "trust-score" | "verify-live" | "compare",

  // Discover params
  limit?: number,              // Max results (discover)
  category?: string,           // Filter by category
  search?: string,             // Search query

  // Trust score / verify params
  endpoint_url?: string,       // URL to check

  // Compare params
  endpoint_urls?: string[]     // 2-5 URLs to compare
}
```

---

## Output Schemas

### Discover Output
```typescript
{
  endpoints: Array<{
    url: string,
    name: string,
    description: string,
    category: string,
    trust_score: number,
    grade: string
  }>,
  total: number,
  limit: number,
  offset: number
}
```

### Trust Score Output
```typescript
{
  endpoint: string,
  trust_score: {
    overall: number,
    uptime: number,
    speed: number,
    accuracy: number,
    age: number,
    grade: string,
    recommendation: string
  },
  stats: {
    total_tests: number,
    successful_tests: number,
    avg_response_time_ms: number,
    last_tested: string
  },
  last_updated: string
}
```

### Verify Live Output
```typescript
{
  endpoint: string,
  test_result: {
    success: boolean,
    status_code: number,
    response_time_ms: number,
    error?: string
  },
  trust_score: {
    overall: number,
    grade: string,
    recommendation: string
  },
  tested_at: string
}
```

### Compare Output
```typescript
{
  comparison: Array<{
    url: string,
    name: string,
    trust_score: number,
    grade: string,
    avg_response_time_ms: number,
    uptime_percentage: number,
    recommendation: string
  }>,
  winner: {
    url: string,
    reason: string
  },
  tested_at: string
}
```

---

## Architecture

PulseRadar uses a **hybrid architecture** for optimal performance:

- **x402 Proxy Layer** - Validates payments and routes requests
- **Edge Backend** - Performs discovery, testing, and scoring
- **Database Layer** - Tracks historical performance data
- **Automated Jobs** - Continuous monitoring and discovery

The system runs 24/7 automated tasks:
- Discovery of new endpoints
- Regular health checks
- Trust score calculations
- Historical data tracking

---

## Why This Matters

### Problem Solved

The x402 ecosystem needs **transparency and trust**. Without PulseRadar, developers and AI agents face:

- No central directory of available services
- No way to know which endpoints are reliable
- Manual testing required for every service
- No historical performance data
- Wasted time and money on unreliable services

### Solution Impact

PulseRadar provides:

1. **Ecosystem Visibility** - Complete directory of x402 services
2. **Trust Building** - Data-driven reliability metrics
3. **Time Savings** - Instant answers vs manual testing
4. **Risk Reduction** - Historical data prevents bad choices
5. **Quality Incentive** - Public trust scores encourage better services

### Use Cases

**For Developers:**
- Find x402 services to integrate
- Monitor their own endpoint's trust score
- Compare alternatives before committing
- Verify services before building dependencies

**For AI Agents:**
- Autonomously discover available services
- Make trust-based routing decisions
- Verify endpoints before payment
- Adapt to changing service quality

**For the Community:**
- Increase ecosystem transparency
- Build confidence in x402 protocol
- Help quality services get discovered
- Hold services accountable with public scores

---

## Competitive Advantages

| Feature | PulseRadar | Manual Testing |
|---------|------------|----------------|
| Discovery | Automatic | Manual search |
| Trust Data | Historical + real-time | One-time test |
| Coverage | Ecosystem-wide | Limited |
| Scoring | Standardized A-F | Subjective |
| Cost | $0.50/query | Time + effort |
| Updates | Continuous | Manual retest |

---

## Impact Metrics

- **First-of-its-kind:** Only dedicated x402 discovery service
- **24/7 Monitoring:** Continuous automated testing
- **Historical Tracking:** Performance data over time
- **Standardized Scoring:** A-F grades for all services
- **Single Endpoint:** All operations via one $0.50 call
- **Ecosystem Benefit:** Infrastructure serving all x402 users

---

## Other Resources

- **Repository:** Private (production deployment)
- **Public Documentation:** https://gist.github.com/HashMonkey710/eb7fbf8cdb67e3d94acd06f5a38e6bb3
- **Payment Address:** 0x01D11F7e1a46AbFC6092d7be484895D2d505095c
- **Organization:** DegenLlama.net
- **x402 Protocol:** v1 with facilitator at https://facilitator.daydreams.systems
- **Price:** $0.50 USDC per query on Base mainnet

---

## Solana Wallet

**Wallet Address:** `Hnf7qnwdHYtSqj7PjjLjokUq4qaHR4qtHLedW7XDaNDG`

---

## Long-term Vision

PulseRadar is infrastructure for the x402 ecosystem. As more services join the network, PulseRadar becomes increasingly valuable:

- **Growing Directory:** More endpoints = more value
- **Better Data:** Longer history = more accurate trust scores
- **Network Effect:** More users = better ecosystem transparency
- **Quality Improvement:** Public scores incentivize reliability
- **Ecosystem Health:** Transparency builds confidence in x402

---

**Built by [DegenLlama.net](https://degenllama.net)**

Thank you for considering PulseRadar as critical infrastructure for the x402 ecosystem!
