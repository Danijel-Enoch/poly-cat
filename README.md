# HoodMarkets

Permissionless prediction markets with bonded optimistic settlement.

- `packages/contracts` — Foundry smart contracts (MarketFactory + OptimisticOracle)
- `packages/indexer` — Ponder indexer
- `packages/web` — Next.js frontend

## Settlement model

Markets settle via a bonded optimistic oracle: after a market closes, anyone can
propose the outcome by posting a bond. If undisputed after a challenge window, it
finalizes and the proposer is rewarded. If disputed (matching bond), an arbitrator
resolves it and the losing side forfeits their bond.

Today, humans call `proposeOutcome` / `disputeOutcome` from EOAs. The contracts make
no identity assumptions about callers — bonding economics are the only admission
control — so autonomous/LLM-driven agents can fill the same roles later without any
contract changes.

## Development

```bash
pnpm install
pnpm contracts:build
pnpm contracts:test
```
