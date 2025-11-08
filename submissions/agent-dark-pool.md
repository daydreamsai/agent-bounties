# Agent Dark Pool - Private MEV Protection

## Agent Description

Agent Dark Pool provides private mempool transaction batching with MEV protection for x402 protocol agents. By batching transactions every 30 seconds in atomic execution, it prevents front-running and sandwich attacks while maintaining privacy. The service charges a 5% privacy premium on transaction value plus a $0.50 USDC submission fee.

## Live Deployment

**x402 Manifest:** https://agent-dark-pool-proxy-production.up.railway.app/.well-known/agent.json

**Submit Endpoint:** https://agent-dark-pool-proxy-production.up.railway.app/entrypoints/submit/invoke

**Network:** Base (Layer 2)
**Payment Asset:** USDC (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
**Price:** $0.50 USDC per submission

## Architecture

The Agent Dark Pool uses a two-layer architecture:

1. **Public Payment Proxy (Railway)** - Handles x402 micropayments and authentication
2. **Private Backend (Cloudflare Workers)** - Transaction queue, batching, and execution

This separation ensures payment processing is isolated from sensitive transaction data.

## Features

- **MEV Protection**: Front-running and sandwich attack prevention through atomic batch execution
- **Privacy Premium**: 5% fee on transaction value
- **Batch Window**: 30-second intervals for optimal privacy
- **Rate Limiting**: 10 requests/minute per client IP
- **Endpoint Validation**: x402 compatibility checking and SSRF protection
- **Security Logging**: All operations logged to Cloudflare D1 database
- **API Key Authentication**: Backend requires X-Internal-API-Key header

## Security

- **Direct Financial Risk**: NONE (proxy only validates payments, doesn't handle funds)
- **Indirect Risk**: LOW (validated endpoints, rate limited, authenticated)
- **No Hardcoded Secrets**: All sensitive data via environment variables
- **SSRF Protection**: Endpoint validation before submission
- **Audit Trail**: Complete security logging in D1 database

## Related Bounty

This is an **open bounty submission** demonstrating a novel use case for the x402 protocol - providing MEV protection as a paid service for AI agents.

## Payment Address

**Solana Wallet:** `Hnf7qnwdHYtSqj7PjjLjokUq4qaHR4qtHLedW7XDaNDG`

## Technical Stack

- **Frontend**: @lucid-agents/agent-kit ^1.1.1
- **Runtime**: Bun
- **Payment Protocol**: x402 HTTP micropayments
- **Proxy Deployment**: Railway
- **Backend**: Cloudflare Workers + D1 Database
- **Network**: Base (L2)
- **Payment Token**: USDC

## Source Code

**Payment Proxy Repository:** https://github.com/DeganAI/agent-dark-pool-proxy

All code is open source with comprehensive documentation, environment variable configuration, and deployment instructions. No sensitive information is committed to the repository.

## Test the Agent

You can test the agent by making a POST request to the submit endpoint with x402 payment:

```bash
POST https://agent-dark-pool-proxy-production.up.railway.app/entrypoints/submit/invoke
Content-Type: application/json
x402-payment: <payment-proof>

{
  "agent_id": "your-agent-id",
  "target_endpoint": "https://example.com/.well-known/agent.json",
  "request_payload": { "key": "value" },
  "payment_amount": "10.00"
}
```

## Documentation

- **GitHub Repository**: https://github.com/DeganAI/agent-dark-pool-proxy
- **README**: Complete setup, deployment, and usage instructions
- **Environment Variables**: Documented in .env.example
- **API Documentation**: Full endpoint schemas and examples

## Additional Notes

This agent demonstrates how x402 can enable privacy-as-a-service for AI agents, opening up new monetization opportunities for developers building protective infrastructure in the agent economy.
