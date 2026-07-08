# Polycat — indexer

A [Ponder](https://ponder.sh) app that indexes `MarketFactory`'s event log
into a small local database, then serves it over SQL-over-HTTP (and GraphQL)
for `packages/web` to query. Everything else in this repo reads the chain
directly (see `packages/web/lib/chainReads.ts`) — this package exists
specifically for the two queries a direct chain read can't answer cheaply:

- **Every market ever created** (admin dashboard) — direct reads only expose
  each asset's *current* market via `currentMarketId`, not the full history.
- **Every market a given address has ever held a position in that's now
  resolved and unclaimed** (portfolio) — `getUserPositions` in
  `lib/chainReads.ts` only scans the most recent ~300 markets as a bounded
  approximation; this indexer tracks every `(marketId, holder)` position
  incrementally off the event log instead, so it's exact regardless of how
  long the chain has been running.
- **Browsing without hammering the RPC** — the home page grid and admin's
  markets table used to each cost dozens of chain reads per poll (every
  asset's current market, plus a `getContractEvents` scan per market just
  for volume). Both now read `market.upSupply`/`downSupply`/`collectedFees`
  from here in one query instead.

The one thing that still always goes straight to the contract is `reserve` —
real, money-moving state (trade quoting in `TradePanel`, the portfolio page's
sell-value estimate) that has to be exact and live, never indexed. See
`DOCS.md` in the repo root for the full picture.

## Schema (`ponder.schema.ts`)

| Table | What it tracks |
|---|---|
| `asset` | One row per `AssetRegistered` |
| `market` | One row per `MarketCreated`, kept live by `SharesBought`/`SharesSold` (`volume`, `tradeCount`, `upSupply`, `downSupply`, `collectedFees`), `FeesWithdrawn` (resets `collectedFees`), and `MarketSettled`/`MarketPushed`/`MarketCancelled`/`CloseTimeExtended` |
| `trade` | One row per `SharesBought`/`SharesSold` |
| `position` | One row per `(marketId, holder)`, a running Up/Down balance updated on every buy/sell and zeroed + flagged `claimed` on `Redeemed`/`RefundClaimed` — mirrors the contract's own `shareBalances` mapping |

`market.upSupply`/`downSupply` are exact, not approximate, despite never
replaying `PythagoreanMath.seedGenesis`'s integer-sqrt math: they start as
equal placeholders (`1n`/`1n`) at creation, which is already the correct
50/50 probability every consumer actually needs (the contract always seeds
both sides equal), then get overwritten with the real bigint values straight
from `newUpSupply`/`newDownSupply` on the very first trade.

## Running

```bash
cp .env.example .env.local   # fill in RPC_URL, CHAIN_ID, MARKET_FACTORY_ADDRESS
pnpm install
pnpm dev                     # live reindex on every restart; from the repo root: pnpm indexer:dev
```

`pnpm dev` runs Ponder's dev server (auto-reindexes on schema/handler changes,
serves the API at `http://localhost:42069`). For a long-lived deployment, use
`pnpm start` instead (from the repo root: `pnpm indexer:start`) — no
hot-reload, requires `DATABASE_SCHEMA` to be set explicitly (`dev` defaults it
to `"public"`; `start` refuses to boot without it, so two deployments can
never accidentally collide on the same schema), and add a real `DATABASE_URL`
(Postgres) so indexed history survives a restart instead of living in a local
PGlite (embedded Postgres) database under `.ponder/`.

`packages/web` points at this server via `NEXT_PUBLIC_PONDER_URL` (see
`packages/web/.env.example`) — defaults to `http://localhost:42069` for local
dev.

## Running with Docker

```bash
docker build -f Dockerfile.indexer -t polycat-indexer .   # from the repo root
docker run --rm -p 42069:42069 --env-file packages/indexer/.env.local polycat-indexer
```

This runs `pnpm start` — a long-lived server, unlike `packages/cron`'s
one-shot container. To use a different port, set `PORT` in the env file (or
`-e PORT=<port>`) and map the same port with `-p`:

```bash
docker run --rm -p 8080:8080 -e PORT=8080 --env-file packages/indexer/.env.local polycat-indexer
```

## Deploying against Robinhood Chain mainnet

Set `RPC_URL`/`CHAIN_ID` to Robinhood Chain's values (see the root `DOCS.md`'s
"Moving to Robinhood Chain mainnet" section), `MARKET_FACTORY_ADDRESS` to the
deployed proxy, and `START_BLOCK` to its actual deploy block (see
`packages/contracts/addresses.txt`) — indexing from block 0 against a live
chain would otherwise scan millions of irrelevant blocks before reaching the
first real event.
