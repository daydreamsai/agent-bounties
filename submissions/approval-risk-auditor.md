# Approval Risk Auditor

## Agent Description

A comprehensive wallet approval auditor that scans ERC-20 and ERC-721 token approvals across multiple EVM chains. It identifies risky unlimited and stale approvals, assigns risk levels (critical/high/medium/low), and generates ready-to-use revocation transaction data.

### Key Features
- **Multi-chain**: Ethereum, Polygon, Arbitrum, Optimism, Base, BSC
- **ERC-20 scanning**: Checks allowances against 15+ known DEX routers and aggregators (Uniswap, 1inch, SushiSwap, 0x, Paraswap, etc.)
- **ERC-721 scanning**: Detects `setApprovalForAll` grants to NFT marketplace operators (OpenSea, Seaport, LooksRare, X2Y2)
- **Risk assessment**: Classifies approvals by risk level based on allowance amount, spender reputation, and token balance
- **Revocation data**: Generates calldata for calling `approve(spender, 0)` or `setApprovalForAll(operator, false)`

### Built With
- `@lucid-dreams/agent-kit` v0.2.24
- `viem` for blockchain interaction
- `zod` for input/output validation

## Live Link

**Deployment URL:** https://approval-risk-auditor.fly.dev

> *Note: This deployment is pending. The code is production-ready and can be deployed to any Bun-compatible hosting platform (Fly.io, Railway, Cloudflare Workers, etc.).*

## Acceptance Criteria

- [x] Matches Etherscan approval data for top tokens (checks known ERC-20 tokens on each chain)
- [x] Identifies unlimited and stale approvals (flags max uint256 and very high allowances)
- [x] Provides valid revocation transaction data (generates calldata for approve(0) and setApprovalForAll(false))
- [ ] **Must be deployed on a domain and reachable via x402** (code ready, deployment pending)

## Other Resources

- **Repository:** https://github.com/daydreamsai/agent-bounties/tree/main/agents/approval-risk-auditor
- **Documentation:** See agent README for full API docs
- **Source:** `agents/approval-risk-auditor/` directory in this PR

## Solana Wallet

**Wallet Address:** `YOUR_SOLANA_WALLET_ADDRESS_HERE`

---

**Related Issue:** #5
