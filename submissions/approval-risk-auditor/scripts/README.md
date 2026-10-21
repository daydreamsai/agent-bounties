# Verification scripts

| Script | What it proves |
|--------|----------------|
| `verify_spenders.ts` | Every known-spender address has on-chain bytecode (`eth_getCode`) — no dead contracts shipped |
| `gen_known_spenders.ts` | Regenerates `src/known_spenders.ts` with EIP-55 checksums computed by `viem.getAddress` (no hand-typed addresses) |
| `smoke.ts` | Runs a real audit against Ethereum mainnet public RPC and prints approvals / risk flags / revoke calldata |
| `e2e_local.py` | Boots the agent locally and checks `/health`, `/entrypoints`, `/.well-known/agent.json` and the 402 response of `/entrypoints/audit/invoke` |

```bash
npx tsx scripts/verify_spenders.ts     # address validation
npx tsx scripts/smoke.ts               # live mainnet audit
python scripts/e2e_local.py            # end-to-end HTTP check
```
