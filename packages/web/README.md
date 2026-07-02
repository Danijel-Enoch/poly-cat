# HoodMarkets — web

Next.js (App Router) frontend: trading UI, market creation, portfolio,
leaderboard, in-product docs, and an admin dashboard. See the repo root
[`README.md`](../../README.md) and [`DOCS.md`](../../DOCS.md) for the full
picture — this file covers just this package.

## Setup

```bash
cp .env.example .env.local
```

Fill in `.env.local` — defaults match a local Anvil + `forge script
script/Deploy.s.sol --broadcast` deployment (see the contracts package). The
Ponder indexer (`packages/indexer`) must be running for market data to load.

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). `/app` is the market
list; `/admin` is only visible/usable to the wallet matching the contract's
`owner()`.

## Env vars

See `.env.example` for the full list with comments. In short:

- `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_PONDER_URL` — where to reach the chain
  and the indexer's GraphQL API.
- `NEXT_PUBLIC_MARKET_FACTORY_ADDRESS`, `NEXT_PUBLIC_MOCK_USDC_ADDRESS` — the
  local/testnet deployment's contract addresses.
- `NEXT_PUBLIC_NETWORK=mainnet` plus the `NEXT_PUBLIC_MAINNET_*` vars — switch
  the whole app to Robinhood Chain. See [`DOCS.md`](../../DOCS.md#moving-to-robinhood-chain-mainnet).

## Structure

```
app/
  page.tsx                 marketing landing page
  (dapp)/                  route group for the actual app
    app/                   markets list (search/filter/sort)
    markets/[id]/          market detail: chart, trade panel, trade history
    create/                create-market form + risk disclosure
    portfolio/              connected wallet's open positions
    leaderboard/            top traders by volume
    docs/                   in-product explainer
    admin/                  owner-only: settle, claim fees, volume, closing-soon
components/                 shared UI (TradePanel, RedeemButton, CreatorFeesPanel, ...)
lib/                        wagmi/viem config, contract addresses+ABIs, Ponder client, math
```

## Deploying

Deploys like any Next.js app (Vercel, etc.) — set the env vars above in your
hosting provider's dashboard, pointed at a reachable RPC endpoint and Ponder
instance (not `localhost`, which only resolves on your own machine).

```bash
pnpm build
pnpm start
```
