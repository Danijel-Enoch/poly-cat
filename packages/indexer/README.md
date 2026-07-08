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

Nothing else changes: live curve state (`reserve`/`upSupply`/`downSupply`),
trading, and redeeming still go straight to the contract, same as before —
see `DOCS.md` in the repo root.

## Schema (`ponder.schema.ts`)

| Table | What it tracks |
|---|---|
| `asset` | One row per `AssetRegistered` |
| `market` | One row per `MarketCreated`, updated by `SharesBought`/`SharesSold` (running `volume`/`tradeCount`) and `MarketSettled`/`MarketPushed`/`MarketCancelled`/`CloseTimeExtended` |
| `trade` | One row per `SharesBought`/`SharesSold` |
| `position` | One row per `(marketId, holder)`, a running Up/Down balance updated on every buy/sell and zeroed + flagged `claimed` on `Redeemed`/`RefundClaimed` — mirrors the contract's own `shareBalances` mapping |

## Running

```bash
cp .env.example .env.local   # fill in RPC_URL, CHAIN_ID, MARKET_FACTORY_ADDRESS
pnpm install
pnpm dev                     # live reindex on every restart; from the repo root: pnpm indexer:dev
```

`pnpm dev` runs Ponder's dev server (auto-reindexes on schema/handler changes,
serves the API at `http://localhost:42069`). For a long-lived deployment, use
`pnpm start` instead (from the repo root: `pnpm indexer:start`) — no
hot-reload, and add a real `DATABASE_URL` (Postgres) so indexed history
survives a restart instead of living in a local SQLite file.

`packages/web` points at this server via `NEXT_PUBLIC_PONDER_URL` (see
`packages/web/.env.example`) — defaults to `http://localhost:42069` for local
dev.

## Deploying against Robinhood Chain mainnet

Set `RPC_URL`/`CHAIN_ID` to Robinhood Chain's values (see the root `DOCS.md`'s
"Moving to Robinhood Chain mainnet" section), `MARKET_FACTORY_ADDRESS` to the
deployed proxy, and `START_BLOCK` to its actual deploy block (see
`packages/contracts/addresses.txt`) — indexing from block 0 against a live
chain would otherwise scan millions of irrelevant blocks before reaching the
first real event.
