# Polycat — cron

A single script (`src/run.ts`) that keeps every registered asset's 5-minute
market running, with no admin dashboard and no human settlement judgment
involved. Assets aren't hardcoded — they're whatever the factory owner has
registered on-chain via `registerAsset` (see the admin dashboard's "Add
market" panel), each tagged with which price API to read it from:
**Gate.com** for centralized-exchange-listed ("blue chip") tokens like
BTC/ETH/SOL, or **DexScreener** for on-chain pairs — starting with CashCat,
the first memecoin on Robinhood Chain. Each run:

1. For every registered asset, if its current market's trading window has
   closed, fetches that asset's live price (from Gate.com or DexScreener,
   per its registered source) and calls `settleMarket` with it.
2. If an asset has no open market (either it's never had one, or the one
   above just got settled), opens the next wall-clock-aligned 5-minute
   window by calling `createMarket` with the current price as the strike.

It's meant to be invoked by a real cron entry, not run as a long-lived
process — one pass, then exit. It's also stateless and idempotent: it derives
everything it needs from on-chain reads plus a price fetch, so re-running it
(or losing/restarting the host) is always safe. See `src/run.ts` for why
settling always happens before opening the next window for a given asset —
that ordering is what keeps a market from ever going unsettled.

## Running

```bash
cp .env.example .env.local   # fill in RPC_URL, CHAIN_ID, MARKET_FACTORY_ADDRESS, CRON_PRIVATE_KEY
pnpm install
pnpm start                   # one pass; from the repo root: pnpm cron:run
```

`CRON_PRIVATE_KEY` must be the deployed `MarketFactory`'s current owner (see
`packages/contracts`) — every call this script makes is owner-only and will
revert otherwise. That account also needs enough native ETH to cover both
gas and each new market's seed liquidity, since `createMarket` sends
`defaultInitialLiquidity` as `msg.value` straight from the owner's own
balance (`factory.setDefaultInitialLiquidity` controls how much). The same
account is also the one that must call `registerAsset` to add new assets (or
use the admin dashboard's "Add market" panel, signed with this same key's
wallet).

## Scheduling it

Pick an interval comfortably shorter than the 5-minute window so a close is
never missed by more than a few transactions' worth of latency — every
30–60 seconds is reasonable. A plain crontab entry is enough:

```cron
* * * * * cd /path/to/polycat/packages/cron && pnpm start >> /var/log/polycat-cron.log 2>&1
```

Because each run is a self-contained pass, don't run overlapping instances —
make sure one pass finishes well within your chosen interval (RPC latency
and the chain's block time are the only real variables), or add a lock
around the crontab entry if that's not guaranteed on your host.

## Price feeds

`src/priceFeed.ts` wraps two public REST APIs, neither needing an API key:

- **Gate.com** (`fetchGatePrice`) — `/spot/tickers?currency_pair=<sourceId>`,
  e.g. `BTC_USDT`. Used for assets registered with `PriceSource.Gate`.
- **DexScreener** (`fetchDexScreenerPrice`) — `/latest/dex/pairs/robinhood/
  <sourceId>`, where `sourceId` is the pair's contract address on Robinhood
  Chain. Used for assets registered with `PriceSource.DexScreener`.

`fetchPriceWad(source, sourceId)` is the single dispatcher `run.ts` calls;
everything downstream only ever sees a WAD (1e18) fixed-point `bigint`, so
adding a third source later just means adding another case there.
