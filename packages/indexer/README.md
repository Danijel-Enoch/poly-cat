# HoodMarkets — indexer

[Ponder](https://ponder.sh) indexer for `MarketFactory`. Tracks
`MarketCreated`, `SharesBought`, `SharesSold`, `MarketSettled`, and `Redeemed`
events into `market` / `trade` / `position` / `redemption` tables (see
`ponder.schema.ts`) and serves them over GraphQL. See the repo root
[`DOCS.md`](../../DOCS.md#indexer) for how this fits into the wider system.

Fee balances (`collectedFees`, `creatorFees`) are intentionally **not**
indexed here — the frontend reads them live on-chain via `getMarket` instead,
since they change on every trade.

## Setup

```bash
cp .env.example .env.local
```

Fill in `MARKET_FACTORY_ADDRESS` with the proxy address from
`forge script script/Deploy.s.sol --broadcast` (see `packages/contracts`).

```bash
pnpm dev
```

GraphQL API + a live indexing status UI at
[http://localhost:42069](http://localhost:42069).

## Production

`ponder start` differs from `ponder dev` in one important way: it requires
`DATABASE_SCHEMA` to be set explicitly (see `.env.example`). Also set
`DATABASE_URL` to a real Postgres instance — without it, Ponder falls back to
an on-disk PGlite database that won't survive a restart or scale past one
instance.

```bash
pnpm start
```

### Docker

```bash
docker build -f ../../Dockerfile -t hoodmarkets-indexer ../..   # from this directory
# or, from the repo root:
docker build -t hoodmarkets-indexer .

docker run --rm -p 42069:42069 --env-file .env.local hoodmarkets-indexer
```

Build from the monorepo root (as shown above) — the image needs the root pnpm
lockfile and workspace `package.json` files to resolve dependencies, even
though this package has no dependency on the others. See the Dockerfile's own
comments and [`DOCS.md`](../../DOCS.md#deploying-the-indexer-with-docker) for
why it pins an exact pnpm version rather than trusting corepack's default
lookup.

## Indexing Robinhood Chain mainnet

Set `PONDER_RPC_URL_ROBINHOOD`, `ROBINHOOD_CHAIN_ID`,
`MARKET_FACTORY_ADDRESS_ROBINHOOD`, and `START_BLOCK_ROBINHOOD` (see
`.env.example`) to also index the mainnet deployment alongside local Anvil.
Leaving any of these unset keeps the indexer anvil-only — this can't
accidentally break local dev.

In production (no local Anvil node to reach), also leave `ENABLE_ANVIL` unset
so the indexer doesn't try to connect to `http://127.0.0.1:8545` and spam the
logs with `ECONNREFUSED` retries. `ENABLE_ANVIL=true` is only meant for local
dev.
