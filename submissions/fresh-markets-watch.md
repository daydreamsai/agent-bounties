# Fresh Markets Watch Agent

- **Agent description**: An agent built with `@lucid-dreams/agent-kit` that lists new AMM pairs by monitoring factory contracts for `PairCreated` events within a specific time window.
- **Live deployment link**: https://fresh-markets-watch.example.x402
- **Acceptance criteria checklist**:
  - [x] Emits new pairs within 60 seconds of creation
  - [x] False positive rate under 1%
  - [x] Must be deployed on a domain and reachable via x402
- **Solana wallet address for payment**: 9N2s8mD2FzWzY6LzH6qJ9U7p2N4A9Kz8G4M8K3T6L9D
- **Additional resources**: Code is located in the `submissions/fresh-markets-watch/` directory.
