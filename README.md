# HoodMarkets

A permissionless prediction market: anyone can create a yes/no question, anyone
can trade shares in the outcome via a bonding-curve AMM, and prices move in real
time to reflect the market's implied probability. Positioned as the first
prediction market on **Robinhood Chain** (Robinhood's Arbitrum-based L2).

- `packages/contracts` — Foundry smart contracts (`MarketFactory`, UUPS upgradeable)
- `packages/indexer` — Ponder indexer
- `packages/web` — Next.js frontend

See [`DOCS.md`](./DOCS.md) for the full architecture writeup (pricing math, fee
split, settlement model, deployment/upgrade flow, mainnet migration). This file
is a quickstart.

## How it works, briefly

- **Pricing**: each market is its own automated market maker on a Pythagorean
  bonding curve (`reserve = c × √(yesSupply² + noSupply²)`) rather than an
  order book or constant-product AMM — there's always a counterparty, even for
  the first trade in a brand-new market.
- **Fees**: a flat protocol trading fee (1% by default, admin-adjustable up to
  5%) applies to every buy/sell. 95% goes to the protocol treasury, 5% to the
  market's creator (withdrawable any time from the market page).
- **Settlement**: admin-only. The contract owner calls `settleMarket` once a
  market closes — no bond, no dispute window, no oracle module. A deliberate
  simplicity tradeoff, not a gap to fix.
- **Upgradeability**: `MarketFactory` sits behind a UUPS (`ERC1967Proxy`)
  proxy, so logic can be upgraded later without migrating market state.

## Development

Prerequisites: [pnpm](https://pnpm.io) 9.x, [Foundry](https://book.getfoundry.sh/getting-started/installation), Node 18+.

```bash
pnpm install
```

Each package needs its own env file — copy the `.env.example` in each of
`packages/{contracts,indexer,web}` to `.env.local` (`.env.local` for contracts
is optional; it defaults to Anvil's well-known account #0 key) and fill in
values as needed. Defaults are wired for the local flow below.

**1. Start a local chain and deploy the contracts:**

```bash
anvil                      # separate terminal, leave running
pnpm contracts:deploy      # forge script script/Deploy.s.sol --broadcast
```

Deploy logs the `MarketFactory` **proxy** address (not the implementation) —
that's the address every other package needs. Copy it into
`packages/indexer/.env.local` (`MARKET_FACTORY_ADDRESS`) and
`packages/web/.env.local` (`NEXT_PUBLIC_MARKET_FACTORY_ADDRESS`).

**2. Start the indexer and frontend:**

```bash
pnpm indexer:dev   # Ponder dev server + GraphQL API at :42069
pnpm web:dev        # Next.js dev server at :3000
```

**3. Run the contract test suite:**

```bash
pnpm contracts:test
```

## Deploying the indexer with Docker

```bash
docker build -f packages/indexer/Dockerfile -t hoodmarkets-indexer .
docker run --rm -p 42069:42069 --env-file packages/indexer/.env.local hoodmarkets-indexer
```

See `packages/indexer/README.md` for production notes (Postgres, `DATABASE_SCHEMA`).

## Deploying the frontend

The web app deploys to Vercel like any Next.js app — set the env vars from
`packages/web/.env.example` in the project's dashboard. See `packages/web/README.md`.

## Moving to Robinhood Chain mainnet

Every mainnet-specific value (chain ID, RPC URL, contract addresses) is env-var
driven with no hardcoded fallback, so switching networks never requires a code
change:

1. Deploy `MarketFactory` to Robinhood Chain (`pnpm contracts:deploy` with
   `--rpc-url` pointed at it) and note the proxy address.
2. Fill in the `NEXT_PUBLIC_MAINNET_*` vars in `packages/web` and the
   `*_ROBINHOOD` vars in `packages/indexer`, then set
   `NEXT_PUBLIC_NETWORK=mainnet` for the frontend.
3. Redeploy both. Missing a required mainnet var fails loudly at startup
   instead of silently pointing at the wrong chain — see `lib/contracts.ts`.

Full details in [`DOCS.md`](./DOCS.md#moving-to-robinhood-chain-mainnet).
