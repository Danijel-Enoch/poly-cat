# HoodMarkets — technical documentation

This is the deeper architecture reference. For a setup quickstart, see
[`README.md`](./README.md). For the in-product explainer users see, see the
`/docs` route in `packages/web`.

## Contents

- [Architecture](#architecture)
- [Pricing: the Pythagorean bonding curve](#pricing-the-pythagorean-bonding-curve)
- [Fees](#fees)
- [Settlement](#settlement)
- [Upgradeability](#upgradeability)
- [Contract reference](#contract-reference)
- [Indexer](#indexer)
- [Frontend](#frontend)
- [Deploying the indexer with Docker](#deploying-the-indexer-with-docker)
- [Moving to Robinhood Chain mainnet](#moving-to-robinhood-chain-mainnet)

## Architecture

```
packages/contracts   Foundry: MarketFactory (UUPS proxy), PythagoreanMath, MockUSDC
packages/indexer     Ponder: indexes MarketFactory events into a queryable GraphQL API
packages/web         Next.js: trading UI, admin dashboard, portfolio, leaderboard
```

One `MarketFactory` contract instance serves every market, keyed by `marketId`,
rather than one clone/proxy per market. Outcome shares are cheap internal
balances (`mapping(marketId => mapping(isYes => mapping(holder => balance)))`),
not per-market ERC20s — this keeps the indexer's job to tracking a single
address and ABI instead of discovering N child contracts per market.

## Pricing: the Pythagorean bonding curve

Each market's AMM state is `(reserve, yesSupply, noSupply)`. The invariant is:

```
reserve = c × √(yesSupply² + noSupply²)
```

`c` starts at 1 at genesis (fully collateralized) and only increases as trading
fees accrue to `reserve` — so `reserve² ≥ yesSupply² + noSupply²` always holds,
which is exactly what guarantees 1:1 redemption can never be
under-collateralized (see the `invariant_ReserveCoversSupplies` fuzz test).

A new market seeds both `yesSupply` and `noSupply` to
`initialLiquidity / √2` (`PythagoreanMath.seedGenesis`), which places the
curve at a 50/50 implied probability with `reserve == initialLiquidity`.

Buying shifts `yesSupply` (or `noSupply`) up while holding the curve invariant,
solving for the shares minted from the collateral paid in; selling is the
inverse. The displayed "chance" percentage is
`yesSupply² / (yesSupply² + noSupply²)` — independent of the fee-driven drift
in `c`, and never used as a settlement signal anywhere in the contract.

Buying supports two modes in the UI: spend an exact USDC amount ("spend"), or
solve for the USDC needed to receive an exact number of shares ("receive") —
the contract only exposes a forward quote, so the inverse is solved client-side
in `packages/web/lib/curveMath.ts`.

## Fees

`feeBps` (default 100 = 1%, admin-adjustable up to `MAX_FEE_BPS` = 500 = 5%) is
charged on every buy (taken from the input) and sell (taken from the output).
Each collected fee is split via `CREATOR_FEE_SHARE_BPS` (500 = 5% of the fee,
not of volume):

```
creatorShare    = feePaid × 500 / 10_000   // 5% of the fee → market creator
protocolShare   = feePaid - creatorShare   // 95% of the fee → protocol treasury
```

Traders always pay the same total `feeBps` — the split only changes who
receives it. Balances accrue per-market in `Market.creatorFees` /
`Market.collectedFees`, withdrawn independently:

- `withdrawCreatorFees(marketId)` — callable only by that market's creator.
- `withdrawFees(marketId)` — callable only by the contract owner (admin), pays
  out to `protocolTreasury`.

A market's creator receives no shares for seeding it — the initial liquidity
purely backs the curve's solvency, and the creator fee share is their only
return, which only accrues if people actually trade. This is the exact
tradeoff surfaced in the create-market UI's risk disclosure.

## Settlement

Admin-only: the contract owner calls `settleMarket(marketId, outcome)` once
`block.timestamp >= closeTime`. No bond, no dispute window, no oracle module —
a single on-chain call sets the final outcome. This is a deliberate simplicity
tradeoff: it keeps the protocol small and fast to reason about, in exchange for
trusting a single admin key rather than a decentralized dispute process. Losing
shares are worthless; `redeem` pays winning shares out 1:1.

The `/admin` route in the frontend (gated to the connected wallet matching
`owner()`) surfaces markets that are past `closeTime` and still `Trading`
("ready to settle") and markets closing within 24h ("closing soon"), plus
per-market protocol fee balances with a claim button.

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
`abi.encodeCall(MarketFactory.initialize, (deployer))` as init data. **The
proxy's address is what every other package uses** — the implementation
address is only needed for `upgradeToAndCall`.

To ship a new implementation:

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
| `createMarket(params)` | anyone | pulls `initialLiquidity`, seeds the curve |
| `buyShares(marketId, isYes, amountIn, minSharesOut)` | anyone | slippage-checked |
| `sellShares(marketId, isYes, sharesIn, minCollateralOut)` | anyone | slippage-checked |
| `redeem(marketId)` | anyone | only after `Finalized` |
| `settleMarket(marketId, outcome)` | owner | only after `closeTime` |
| `withdrawFees(marketId)` | owner | protocol's 95% share |
| `withdrawCreatorFees(marketId)` | market creator | creator's 5% share |
| `setFeeBps(bps)` / `setProtocolTreasury(addr)` | owner | |
| `upgradeToAndCall(newImpl, data)` | owner | UUPS upgrade |
| `getMarket(marketId)` / `getProbability(marketId)` / `shareBalanceOf(...)` | anyone | views |

## Indexer

Ponder (`packages/indexer`) tracks `MarketFactory`'s events into four tables
(`market`, `trade`, `position`, `redemption` — see `ponder.schema.ts`) and
serves them over GraphQL at `/graphql`. Fee balances (`collectedFees`,
`creatorFees`) are **not** indexed — they're read live on-chain via
`getMarket` wherever the UI needs them (`CreatorFeesPanel`, `/admin`), since
they change on every trade and staying in sync with an indexed copy isn't
worth the complexity.

`ponder dev` (local, auto-reloading, permissive defaults) and `ponder start`
(production) differ in one important way: `ponder start` requires
`DATABASE_SCHEMA` to be set explicitly — see `.env.example`.

## Frontend

Next.js App Router, route-grouped into a marketing landing page (`app/page.tsx`)
and the dapp proper (`app/(dapp)/*`: markets list, market detail, create,
portfolio, leaderboard, docs, admin). Wallet state is `wagmi` + `viem`, backed
by a single injected connector. Every write flow (`TradePanel`, create,
`RedeemButton`, `CreatorFeesPanel`, `/admin`) follows the same shape:
`writeContractAsync` → `waitForTransactionReceipt` → refetch the relevant reads.

USDC spending approval is a single `approve(spender, maxUint256)` call the
first time a wallet trades or creates a market against a given collateral
token — not a per-transaction approval — matching how real USDC's
`_spendAllowance` treats a max allowance (never decrements it).

`lib/wagmi.ts`'s `createConfig` sets `ssr: true`, which is required for
Next.js SSR + wagmi to agree on connection state during hydration: server
renders always see "disconnected" (they have no wallet), so the client's first
paint must too, reconciling to the real state only after mount. Omitting this
produces a hydration mismatch on any component that branches on
`useAccount().isConnected`.

## Deploying the indexer with Docker

```bash
docker build -f packages/indexer/Dockerfile -t hoodmarkets-indexer .
docker run --rm -p 42069:42069 --env-file packages/indexer/.env.local hoodmarkets-indexer
```

The Dockerfile builds from the **monorepo root** as context (`indexer` has no
dependency on the other workspace packages, but pnpm still needs the root
lockfile and every workspace member's `package.json` to resolve). It pins the
exact pnpm version via `corepack prepare` rather than relying on a
runtime `packageManager` field lookup, since the final image doesn't carry the
root `package.json` — without the pin, corepack fetches whatever pnpm is
latest, which may need a newer Node than the image ships (this broke in
practice: pnpm 11 requires Node ≥22, the image ships Node 20).

For a real deployment: point `DATABASE_URL` at Postgres (PGlite is dev-only —
it's on-disk and single-instance), and keep `DATABASE_SCHEMA` set. The image
exposes a Docker `HEALTHCHECK` against Ponder's `/health` endpoint.

## Moving to Robinhood Chain mainnet

Robinhood Chain's network parameters are now known and filled in as real
values across all three `.env.example` files (confirmed, not guessed: chain ID
via `eth_chainId` against the RPC URL, the collateral token via the block
explorer's own API — it's **USDG** ("Global Dollar"), not USDC, though it
shares USDC's 6 decimals). `MarketFactory` is now deployed to mainnet — proxy
`0x18189829F3906Ed57e1B215873A9dd0A237D04DD`, implementation
`0x04462E84EAC64ef0531Ed9778D33836631a97186`, owned by
`0x0Ce79fe7497DAf6FDba339768B2577E120b4f285` — and the addresses below are
wired into every package's `.env.local`:

| | Chain ID | RPC | Explorer | Collateral token |
|---|---|---|---|---|
| Value | `4663` | `https://rpc.mainnet.chain.robinhood.com` | `https://robinhoodchain.blockscout.com` | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` (USDG) |

**`packages/contracts`** (`script/Deploy.s.sol`):

```bash
USDC_ADDRESS=0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168 \
  forge script script/Deploy.s.sol --rpc-url https://rpc.mainnet.chain.robinhood.com --broadcast --verify
```

Setting `USDC_ADDRESS` skips deploying/minting `MockUSDC` and uses that
address as the collateral token instead — `MockUSDC` deployment is otherwise
unconditional, which is only correct for local/testnet. This logs the
`MarketFactory` **proxy** address, which is what steps below need.

**`packages/web`** (`lib/wagmi.ts`, `lib/contracts.ts`):

| Env var | Purpose |
|---|---|
| `NEXT_PUBLIC_NETWORK=mainnet` | switches the whole app off local Anvil |
| `NEXT_PUBLIC_MAINNET_CHAIN_ID` | `4663` |
| `NEXT_PUBLIC_MAINNET_CHAIN_NAME` | display name (defaults to "Robinhood Chain") |
| `NEXT_PUBLIC_MAINNET_RPC_URL` | `https://rpc.mainnet.chain.robinhood.com` |
| `NEXT_PUBLIC_MAINNET_EXPLORER_URL` | `https://robinhoodchain.blockscout.com` |
| `NEXT_PUBLIC_MAINNET_CURRENCY_NAME` / `_SYMBOL` | native gas token (defaults to Ether/ETH — unconfirmed, but Robinhood Chain is an Arbitrum L2 and the explorer's own coin icon/price data both point to ETH) |
| `NEXT_PUBLIC_MAINNET_MARKET_FACTORY_ADDRESS` | `0x18189829F3906Ed57e1B215873A9dd0A237D04DD` (mainnet proxy) |
| `NEXT_PUBLIC_MAINNET_USDC_ADDRESS` | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` (USDG) |

If `NEXT_PUBLIC_NETWORK=mainnet` and either address var is unset, the app
throws immediately at startup (`lib/contracts.ts`'s `requireMainnetEnv`) —
fail loudly, not silently-wrong.

Note the UI hardcodes the label "USDC" in several places (trade panel, create
form, trade history, docs) — accurate for local/testnet MockUSDC, but wrong on
mainnet where the real collateral token is USDG. Not yet updated to be
network-aware; do this before actually flipping `NEXT_PUBLIC_NETWORK=mainnet`
in a user-facing deployment.

**`packages/indexer`** (`ponder.config.ts`):

| Env var | Purpose |
|---|---|
| `PONDER_RPC_URL_ROBINHOOD` | `https://rpc.mainnet.chain.robinhood.com` |
| `ROBINHOOD_CHAIN_ID` | `4663` |
| `MARKET_FACTORY_ADDRESS_ROBINHOOD` | `0x18189829F3906Ed57e1B215873A9dd0A237D04DD` (mainnet proxy) |
| `START_BLOCK_ROBINHOOD` | `1495391` (block the proxy was deployed at) |

The mainnet chain is only added to the indexer's config when **all three** of
`PONDER_RPC_URL_ROBINHOOD`, `ROBINHOOD_CHAIN_ID`, and
`MARKET_FACTORY_ADDRESS_ROBINHOOD` are set (not just the first two — a chain
entry with no contract address fails Ponder's config validation outright, so
this repo's own `.env.local` has the RPC/chain ID filled in but stays
anvil-only until the contract address is too). This can't accidentally break
local dev before you're ready to deploy.
