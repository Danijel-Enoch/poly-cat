# Polycat — web

Next.js (App Router) frontend: fixed 5-minute Up/Down trading UI (native ETH),
portfolio, in-product docs, and a trimmed admin dashboard. See the repo root
[`README.md`](../../README.md) and [`DOCS.md`](../../DOCS.md) for the full
picture — this file covers just this package.

## Setup

```bash
cp .env.example .env.local
```

Fill in `.env.local` — defaults match a local Anvil + `forge script
script/Deploy.s.sol --broadcast` deployment (see the contracts package).
There's no indexer to run: this app reads the chain directly (see
`lib/chainReads.ts`). For markets to actually exist, `packages/cron`'s
script needs to have run at least once against the same deployment.

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). `/app` is the asset
list (every market is a fixed 5-minute window); `/admin` is only
visible/usable to the wallet matching the contract's `owner()` (the cron
wallet in production) — that's also where new assets get added.

## Env vars

See `.env.example` for the full list with comments. In short:

- `NEXT_PUBLIC_RPC_URL` — where to reach the chain.
- `NEXT_PUBLIC_MARKET_FACTORY_ADDRESS` — the local/testnet deployment's
  contract address. Trading is native ETH, so there's no separate collateral
  token address to set.
- `NEXT_PUBLIC_NETWORK=mainnet` plus the `NEXT_PUBLIC_MAINNET_*` vars — switch
  the whole app to Robinhood Chain. See [`DOCS.md`](../../DOCS.md#moving-to-robinhood-chain-mainnet).

## Structure

```
app/
  page.tsx                 marketing landing page
  (dapp)/                  route group for the actual app
    app/                   the registered-asset list (home) — each a fixed 5-minute window
    markets/[id]/          market detail: strike, price chart, trade panel, trade history
    portfolio/             connected wallet's open positions
    docs/                  in-product explainer
    admin/                 owner-only: add markets (DexScreener/Gate.com search), status,
                            emergency extend/cancel, fee claims
  api/price/[assetId]/     server-side proxy to Gate.com candlesticks (Gate-sourced assets only)
  api/dexscreener/search/  server-side proxy to DexScreener search, filtered to Robinhood Chain
  api/gate/pairs/          server-side proxy to Gate.com's tradable USDT pairs list
components/                 shared UI (MarketCard, TradePanel, RedeemButton, DexScreenerEmbed, ...)
lib/                        wagmi/viem config, contract addresses+ABI, chainReads.ts, math
```

## Deploying

Deploys like any Next.js app (Vercel, etc.) — set the env vars above in your
hosting provider's dashboard, pointed at a reachable RPC endpoint (not
`localhost`, which only resolves on your own machine). Separately, make sure
`packages/cron` is scheduled somewhere (see its README) — this app only
reads chain state, it never creates or settles markets itself.

```bash
pnpm build
pnpm start
```
