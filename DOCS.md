# Polycat — technical documentation

This is the deeper architecture reference. For a setup quickstart, see
[`README.md`](./README.md). For the in-product explainer users see, see the
`/docs` route in `packages/web`.

## Contents

- [Architecture](#architecture)
- [Assets and market lifecycle](#assets-and-market-lifecycle)
- [Pricing: the Pythagorean bonding curve](#pricing-the-pythagorean-bonding-curve)
- [Fees](#fees)
- [Settlement](#settlement)
- [Upgradeability](#upgradeability)
- [Contract reference](#contract-reference)
- [The cron script](#the-cron-script)
- [Frontend](#frontend)
- [Deploying the cron script with Docker](#deploying-the-cron-script-with-docker)
- [Moving to Robinhood Chain mainnet](#moving-to-robinhood-chain-mainnet)

## Architecture

```
packages/contracts   Foundry: MarketFactory (UUPS proxy), PythagoreanMath
packages/cron        Node/TS: opens each registered asset's next 5-minute window
                      and settles the previous one off a live price feed, on a schedule
packages/indexer     Ponder: indexes MarketFactory's event log, queried as
                      GraphQL — backs browsing (home page grid, admin's
                      markets table and full history) and full-history
                      lookups a direct chain read can't do cheaply (every
                      market a user has ever entered and still needs to
                      redeem/refund)
packages/web         Next.js: trading UI, portfolio, docs, admin (incl. adding new assets)
```

One `MarketFactory` contract instance serves every market, keyed by
`marketId`, rather than one clone/proxy per market. Outcome shares are cheap
internal balances
(`mapping(marketId => mapping(isUp => mapping(holder => balance)))`), not
per-market ERC20s. `packages/web` reads most things from `packages/indexer`
now rather than the chain directly — the exception is `reserve` (trade
quoting, the portfolio page's sell-value estimate), real money-moving state
that has to be exact and live, never indexed; see [Frontend](#frontend) for
the split. `packages/cron` is still the only thing that ever writes to the
contract other than traders themselves and the owner registering new assets.

## Assets and market lifecycle

Assets are an owner-curated, open-ended registry (`registerAsset`), not a
fixed list — see the admin dashboard's "Add market" panel, which searches
either **DexScreener** (scoped to Robinhood Chain pairs — memecoins, seeded
at deploy with CashCat, the first one) or **Gate.com**'s tradable USDT pairs
("blue chip" tokens — seeded at deploy with BTC, ETH, SOL). Each registered
asset is tagged with a `PriceSource` (`Gate` or `DexScreener`) and a
`sourceId` (a Gate.com currency pair like `"BTC_USDT"`, or a DexScreener pair
address) that tells `packages/cron` which API to read its price from.

Every asset gets a single fixed **5-minute** window at a time, tracked by
`currentMarketId[assetId]` on the contract (earlier versions of this product
had 30-minute and 1-hour timeframes too; they were dropped as unnecessary
complexity). `packages/cron` drives the whole lifecycle, once per run, per
registered asset:

1. If the asset's current market is `Trading` and its window has closed,
   fetch that asset's live price (from Gate.com or DexScreener, per its
   registered source) and call `settleMarket`.
2. If the asset has no market, or its market is now resolved
   (`Finalized`/`Cancelled`), open the next **wall-clock-aligned** window —
   always starts on a multiple of 5 minutes since epoch — via
   `createMarket`, using the current price as the strike.

Settling always happens before an asset's next window opens, which is what
keeps a market from ever going unsettled: `currentMarketId` only ever
advances once the market it currently points at is resolved, so there's
never an orphaned earlier market hiding behind a newer one. See
`packages/cron/src/run.ts` for the implementation.

## Pricing: the Pythagorean bonding curve

Each market's AMM state is `(reserve, upSupply, downSupply)`. The invariant is:

```
reserve = c × √(upSupply² + downSupply²)
```

`c` starts at 1 at genesis (fully collateralized) and only increases as trading
fees accrue to `reserve` — so `reserve² ≥ upSupply² + downSupply²` always
holds, which is exactly what guarantees 1:1 redemption can never be
under-collateralized (see the `invariant_ReserveCoversSupplies` fuzz test).

A new market seeds both `upSupply` and `downSupply` to
`defaultInitialLiquidity / √2` (`PythagoreanMath.seedGenesis`), which places
the curve at a 50/50 implied probability with `reserve ==
defaultInitialLiquidity`. The math itself (`PythagoreanMath.sol`) has no
notion of what the two outcomes mean — it's the exact same library this
protocol used before the pivot from arbitrary yes/no markets, unchanged.

Buying shifts `upSupply` (or `downSupply`) up while holding the curve
invariant, solving for the shares minted from the collateral paid in;
selling is the inverse. The displayed "chance" percentage is
`upSupply² / (upSupply² + downSupply²)` — independent of the fee-driven
drift in `c`, and independent of (and never used as a substitute for) the
strike/close price that actually determines settlement.

Buying supports two modes in the UI: spend an exact ETH amount ("spend"), or
solve for the ETH needed to receive an exact number of shares ("receive") —
the contract only exposes a forward quote, so the inverse is solved client-side
in `packages/web/lib/curveMath.ts`. Every market is denominated in native
ETH: `buyShares`/`createMarket` are `payable` and take payment as `msg.value`
rather than pulling an ERC20 via `transferFrom`, and every payout (sell,
redeem, refund, fee withdrawal) is a low-level `call{value: ...}`.

## Fees

`feeBps` (default 100 = 1%, owner-adjustable up to `MAX_FEE_BPS` = 500 = 5%)
is charged on every buy (taken from the input) and sell (taken from the
output). Unlike the pre-pivot design, there's no creator fee split — windows
are seeded with protocol-owned liquidity (`defaultInitialLiquidity`, pulled
from the owner/cron wallet at `createMarket` time), not a user-provided one,
so every collected fee simply accrues to `Market.collectedFees` and is
withdrawn via `withdrawFees(marketId)` (owner-only, pays out to
`protocolTreasury`).

## Settlement

Settlement is fully mechanical, driven by `packages/cron`:

1. Once a window's `closeTime` has passed, the cron script fetches the
   asset's current price — from Gate.com's public REST ticker if it's a
   `Gate`-sourced asset, or DexScreener's public pairs API if it's
   `DexScreener`-sourced (see `packages/cron/src/priceFeed.ts`) — and calls
   `settleMarket(marketId, closePriceWad)`.
2. The contract compares `closePriceWad` to the `startPriceWad` recorded
   when the window opened:
   - below the strike → Down wins (`outcome = false`), state → `Finalized`
   - above the strike → Up wins (`outcome = true`), state → `Finalized`
   - exactly equal → a push: state → `Cancelled`, and every holder claims a
     pro-rata share of the reserve via `claimRefund` (the same path a
     manually cancelled market uses) instead of either side "winning"

No bond, no dispute window, no human judgment call — the rule is the same
every time, and it's the same code path whether the price moved a lot or
landed exactly on the strike. Losing shares are worthless; `redeem` pays
winning shares out 1:1.

The `/admin` route in the frontend (gated to the connected wallet matching
`owner()`) is not a settlement UI — the only thing an operator actually does
there day-to-day is register new assets (the "Add market" panel). It also
shows every registered asset's live market status and lets the owner extend a
window's deadline or cancel it manually — a safety valve for when the cron
script isn't running, not something used in normal operation — plus
per-market protocol fee claims.

Two more admin controls are purely about the public markets page's display,
not the contract: **delist/relist** hides an asset from the public grid
entirely (a delisted asset's market keeps trading and settling normally
on-chain for anyone with a direct link — this only affects discoverability),
and **reorder** (↑/↓ per row) sets which assets show first. Both are
off-chain, admin-curated state in `lib/assetDisplayStore.ts` — Redis-backed
(see `lib/redis.ts`, `REDIS_URL`), unlike the pause list above
(`lib/assetStatusStore.ts`), which stays a local JSON file since
`packages/cron` needs filesystem-level access to it too; delist/reorder is a
`packages/web`-only display concern with no such constraint. Degrades to
"nothing delisted, natural order" if `REDIS_URL` is unset, rather than
crashing.

## Upgradeability

`MarketFactory` is deployed behind an `ERC1967Proxy` using OpenZeppelin's UUPS
pattern (`Initializable`, `OwnableUpgradeable`, `UUPSUpgradeable`). Only the
owner can push a new implementation, via `upgradeToAndCall`
(`_authorizeUpgrade` is `onlyOwner`). Reentrancy protection uses
`ReentrancyGuardTransient` (EIP-1153 transient storage) rather than the
classic storage-based guard — it's stateless (`@custom:stateless`, per OZ's own
annotation) so it needs no initializer call, unlike most of this contract's
other base classes.

`script/Deploy.s.sol` deploys the implementation, then the proxy with
`abi.encodeCall(MarketFactory.initialize, (deployer))` as init data — there's
no collateral token address to wire in, since every market is native ETH.
**The proxy's address is what every other package uses** — the
implementation address is only needed for `upgradeToAndCall`.

This version's storage layout (native ETH instead of an ERC20 collateral
token, no creator/question fields, an owner-curated `assets` registry plus
`assetId`/`startPriceWad` on each market instead) is a fresh design, not an
in-place upgrade of the pre-pivot arbitrary-market contract — the two mean
different things by nearly every field, so any real deployment of this
version starts from a new `Deploy.s.sol` run rather than `upgradeToAndCall`
against an existing proxy.

To ship a new implementation of *this* version later:

```solidity
contract MarketFactoryV2 is MarketFactory {
    // new logic
}
```

```bash
forge script script/UpgradeV2.s.sol --rpc-url <rpc> --broadcast   # deploy impl, call upgradeToAndCall
```

(No `UpgradeV2.s.sol` ships by default — write one per upgrade, mirroring the
pattern in `test/MarketFactory.t.sol`'s `test_UpgradeToAndCall_*` tests, which
also assert that existing market state survives an upgrade unchanged.)

## Contract reference

Key entry points on `MarketFactory` (see the contract's NatSpec for full
signatures):

| Function | Who | Notes |
|---|---|---|
| `registerAsset(symbol, source, sourceId)` | owner | the entire "add a market" flow — `source` is `Gate` or `DexScreener` |
| `createMarket(assetId, startTime, closeTime, startPriceWad)` (`payable`) | owner (cron) | seeds the curve with `msg.value`, which must equal `defaultInitialLiquidity` |
| `buyShares(marketId, isUp, minSharesOut)` (`payable`) | anyone | pays with `msg.value`; slippage-checked |
| `sellShares(marketId, isUp, sharesIn, minCollateralOut)` | anyone | slippage-checked |
| `redeem(marketId)` | anyone | only after `Finalized` |
| `settleMarket(marketId, closePriceWad)` | owner (cron) | only after `closeTime`; ties push instead of finalizing |
| `extendCloseTime(marketId, newCloseTime)` / `cancelMarket(marketId)` | owner | emergency-only escape hatches |
| `claimRefund(marketId)` | anyone | only after `Cancelled` (manual cancel or a tie/push) |
| `withdrawFees(marketId)` | owner | full fee balance, no creator split |
| `setFeeBps(bps)` / `setProtocolTreasury(addr)` / `setDefaultInitialLiquidity(amount)` | owner | |
| `upgradeToAndCall(newImpl, data)` | owner | UUPS upgrade |
| `getMarket(marketId)` / `getAsset(assetId)` / `getProbability(marketId)` / `currentMarketId(assetId)` / `shareBalanceOf(...)` | anyone | views |

## The cron script

`packages/cron/src/run.ts` is a single script meant to be invoked by a real
crontab entry (or equivalent scheduler) every 30–60 seconds — one pass, then
exit, not a long-running process. It's stateless: every decision it makes
comes from a fresh on-chain read (`currentMarketId`, `getMarket`) plus a
price fetch, so re-running it — or losing the host entirely — is always
safe. See [Market slots and lifecycle](#market-slots-and-lifecycle) above
for the settle-before-create ordering that keeps every market eventually
settled, and `packages/cron/README.md` for running/scheduling it.

## Frontend

Next.js App Router, route-grouped into a marketing landing page (`app/page.tsx`)
and the dapp proper (`app/(dapp)/*`: the asset list (home), market detail,
portfolio, docs, admin). Wallet state is `wagmi` + `viem`, backed by a single
injected connector. Every write flow (`TradePanel`, `RedeemButton`,
`ClaimRefundButton`, `AddMarketPanel`, `/admin`) follows the same shape:
`writeContractAsync` → `waitForTransactionReceipt` → refetch the relevant reads.

`lib/chainReads.ts` reads the chain directly via `viem` for whatever has to
be exact and live: trade quoting (`TradePanel`), a specific open market's own
page, redeem/refund, and the portfolio page's "Ur bag" sell-value estimate
(`getUserPositions`, a bounded ~300-market scan — deliberately not exact,
since a live `reserve` figure only exists on-chain). It deliberately avoids
the `multicall` client action (it needs a `Multicall3` contract registered on
the target chain, which a fresh local Anvil instance doesn't have) in favor
of `Promise.all` over individual reads with HTTP request batching enabled on
the transport. Per-market trade history uses `getContractEvents` scoped to
that market's own short (5min) block range rather than an unbounded scan,
found via a binary search for the block at the market's `startTime` — cheap
regardless of how long the chain has been running, since it's O(log blocks)
point lookups, not a range scan.

Everything else — anything that's either browsing (not trading) or needs
full history — reads `packages/indexer` instead, as plain GraphQL over HTTP
(`lib/indexerApi.ts`, hand-rolled `fetch` calls, no GraphQL client library):
the home page grid and admin's live markets table (`fetchIndexerMarketsList`
— each asset's current market, one indexer round-trip via aliased sub-queries
regardless of asset count, replacing what used to be dozens of RPC calls per
poll), the admin dashboard's "All markets ever created" table
(`fetchAllMarkets`, `components/AdminMarketHistory.tsx` — a direct chain read
only ever exposes each asset's *current* market via `currentMarketId`, not
its full history), and the portfolio page's "Needs redeeming" list
(`fetchRedeemablePositions`, `components/NeedsRedeemingList.tsx` — every
market a wallet has ever held a position in that's now resolved and still
unclaimed, exact regardless of how long ago it was opened). All three poll
on the same 10-second interval the rest of the app's admin/portfolio queries
already use — see `packages/indexer/README.md` for the indexer itself.

The price chart on a market's page depends on the asset's source: a
Gate-sourced ("blue chip") market plots real candlesticks (from
`/api/price/[assetId]`, a server-side proxy to Gate.com's public candlesticks
endpoint — the same source `packages/cron` uses for settlement) against the
recorded strike; a DexScreener-sourced (memecoin) market instead embeds
DexScreener's own chart widget (`components/DexScreenerEmbed.tsx`), since
DexScreener's public API exposes current pair state but no historical-candles
endpoint to build a custom chart from. Either way, this plots the *real*
asset price against the strike rather than the AMM's implied-probability
curve — more meaningful for a product where the question is "is the price
above or below where it started," not "what does the order flow imply."

Adding a market is entirely an admin-dashboard action, not a code change:
`AddMarketPanel` searches `/api/dexscreener/search` (proxies DexScreener's
search API, filtered server-side to Robinhood Chain pairs) or `/api/gate/
pairs` (proxies Gate.com's tradable USDT pairs, filtered server-side), and
registering a result calls `registerAsset` directly. `packages/cron` picks up
any newly registered asset on its next pass with no further action needed.

Trading is a single transaction: `buyShares` is `payable` and takes payment as
`msg.value`, so there's no ERC20 approval step before a wallet's first trade —
unlike the pre-rewrite USDC/USDG version, `TradePanel` never submits a
separate `approve` transaction.

`lib/wagmi.ts`'s `createConfig` sets `ssr: true`, which is required for
Next.js SSR + wagmi to agree on connection state during hydration: server
renders always see "disconnected" (they have no wallet), so the client's first
paint must too, reconciling to the real state only after mount. The same
hydration hazard applies to anything else derived from "now" (a countdown,
"has this window closed") — `lib/useNow.ts` returns `null` until the first
client tick specifically so components render an identical placeholder on
the server and the client's first paint, filling in the live value a moment
after mount instead of mismatching.

## Deploying the cron script with Docker

```bash
docker build -t polycat-cron .
docker run --rm --env-file packages/cron/.env.local polycat-cron
```

Unlike a typical app image, this isn't a long-running server — the container
runs one pass and exits, matching how `packages/cron` is meant to be invoked
(schedule the `docker run` command itself via a host crontab, or run it as a
Kubernetes CronJob). The Dockerfile builds from the **monorepo root** as
context (`cron` has no dependency on the other workspace packages, but pnpm
still needs the root lockfile and every workspace member's `package.json` to
resolve). It pins the exact pnpm version via `corepack prepare` rather than
relying on a runtime `packageManager` field lookup, since the final image
doesn't carry the root `package.json` — without the pin, corepack fetches
whatever pnpm is latest, which may need a newer Node than the image ships.

## Moving to Robinhood Chain mainnet

Robinhood Chain's network parameters are known and filled in as real values
across the `.env.example` files (confirmed, not guessed: chain ID via
`eth_chainId` against the RPC URL). There's no collateral token to confirm —
every market trades in the chain's own native ETH, the same asset gas is
paid in:

| | Chain ID | RPC | Explorer |
|---|---|---|---|
| Value | `4663` | `https://rpc.mainnet.chain.robinhood.com` | `https://robinhoodchain.blockscout.com` |

This version of `MarketFactory` (the fixed-timeframe Up/Down redesign) has
**not** been deployed to mainnet yet — its storage layout and ABI are
incompatible with whatever was deployed under the pre-pivot arbitrary-market
design, so this is a fresh deployment, not an upgrade of an existing proxy.

**`packages/contracts`** (`script/Deploy.s.sol`):

```bash
forge script script/Deploy.s.sol --rpc-url https://rpc.mainnet.chain.robinhood.com --broadcast --verify
```

This logs the `MarketFactory` **proxy** address, which is what the steps
below need. Before running this against real funds: reassign ownership away
from the deploying key to whatever account will actually run `packages/cron`
in production (and ideally put a multisig behind upgrade rights
specifically) — and make sure that account's own ETH balance can cover both
gas and the `defaultInitialLiquidity` each new market's `createMarket` call
seeds from it.

**`packages/web`** (`lib/wagmi.ts`, `lib/contracts.ts`):

| Env var | Purpose |
|---|---|
| `NEXT_PUBLIC_NETWORK=mainnet` | switches the whole app off local Anvil |
| `NEXT_PUBLIC_MAINNET_CHAIN_ID` | `4663` |
| `NEXT_PUBLIC_MAINNET_CHAIN_NAME` | display name (defaults to "Robinhood Chain") |
| `NEXT_PUBLIC_MAINNET_RPC_URL` | `https://rpc.mainnet.chain.robinhood.com` |
| `NEXT_PUBLIC_MAINNET_EXPLORER_URL` | `https://robinhoodchain.blockscout.com` |
| `NEXT_PUBLIC_MAINNET_CURRENCY_NAME` / `_SYMBOL` | native gas token (defaults to Ether/ETH — unconfirmed, but Robinhood Chain is an Arbitrum L2 and the explorer's own coin icon/price data both point to ETH) |
| `NEXT_PUBLIC_MAINNET_MARKET_FACTORY_ADDRESS` | the proxy address from the deploy step above |
| `NEXT_PUBLIC_PONDER_URL` | `packages/indexer`'s deployed API server URL |
| `REDIS_URL` | backs the admin dashboard's delist/reorder controls (`lib/assetDisplayStore.ts`) — optional, degrades to "nothing delisted, natural order" if unset |

If `NEXT_PUBLIC_NETWORK=mainnet` and the address var is unset, the app
throws immediately at startup (`lib/contracts.ts`'s `requireMainnetEnv`) —
fail loudly, not silently-wrong.

**`packages/cron`** (`.env.local`):

| Env var | Purpose |
|---|---|
| `RPC_URL` | `https://rpc.mainnet.chain.robinhood.com` |
| `CHAIN_ID` | `4663` |
| `MARKET_FACTORY_ADDRESS` | the proxy address from the deploy step above |
| `CRON_PRIVATE_KEY` | a dedicated hot wallet that is the factory's owner — see `packages/cron/README.md` for what it needs (gas, collateral approval) |

**`packages/indexer`** (`.env.local`):

| Env var | Purpose |
|---|---|
| `RPC_URL` | `https://rpc.mainnet.chain.robinhood.com` |
| `CHAIN_ID` | `4663` |
| `MARKET_FACTORY_ADDRESS` | the proxy address from the deploy step above |
| `START_BLOCK` | the block the deploy step above logged — indexing from 0 against a live chain scans every block back to genesis |
| `DATABASE_SCHEMA` | required by `ponder start` (unlike `dev`, which defaults it to `"public"`) — fails loudly rather than risk two deployments colliding on one schema |
| `DATABASE_URL` | a real Postgres connection string — the default embedded PGlite database is fine for local dev, not a long-lived deployment |
| `PORT` | only if the platform assigns its own port or 42069 conflicts — Ponder reads this directly (see `Dockerfile.indexer`) |
