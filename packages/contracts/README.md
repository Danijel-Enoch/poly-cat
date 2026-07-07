# Robin Markets — contracts

Foundry project for `MarketFactory` — a fixed 5-minute Up/Down market
factory over an owner-curated, open-ended asset registry, a Pythagorean
bonding-curve AMM, and a collateral custody hub, all in one contract instance
deployed behind a UUPS (`ERC1967Proxy`) upgradeable proxy. The owner
registers assets (`registerAsset`, surfaced in the web app's admin
dashboard) tagged with which off-chain price API each is read from — Gate.com
for centralized-exchange-listed ("blue chip") tokens, DexScreener for
on-chain pairs. Markets themselves aren't user-created: an off-chain cron
script (see `packages/cron`) is the contract owner and is the only account
that can open a new market for a registered asset (`createMarket`) or settle
one (`settleMarket`, by submitting the observed close price — see the root
[`DOCS.md`](../../DOCS.md) for the full settlement rule). This file covers
just building/testing/deploying.

## Build & test

```bash
forge build
forge test          # full suite
forge test -vvv     # from the repo root: pnpm contracts:test
```

Test suite covers `MarketFactory.t.sol` (unit tests: market creation and slot
conflicts, trading, fees, settlement incl. the Up/Down/tie-push outcomes, UUPS
upgrades), `PythagoreanMath.t.sol` (fuzz tests on the curve math itself:
solvency, monotonicity, round-trip non-profitability — unaffected by the
Up/Down pivot since the library has no notion of what the two outcomes mean),
and `test/invariant/MarketInvariants.t.sol` (a `Handler`-driven invariant test
asserting collateral conservation and curve solvency hold across arbitrary
sequences of create/buy/sell/settle/redeem).

## Local deployment

```bash
anvil                                                    # separate terminal
cp .env.example .env.local                               # optional — defaults to Anvil account #0
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
```

This deploys `MockUSDC` (minting test funds to the deployer), the
`MarketFactory` implementation, and an `ERC1967Proxy` pointed at it
(initialized with the deployer as owner and MockUSDC as the fixed collateral
token). It also approves the factory to pull from the deployer's own MockUSDC
balance, since `createMarket` seeds every new market's liquidity from the
owner's wallet, and registers the initial asset list — BTC/ETH/SOL
(Gate-sourced) and CashCat (DexScreener-sourced, Robinhood Chain's first
memecoin). **The proxy address is what every other package uses**
(`packages/cron`, `packages/web`) — the implementation address is only needed
if you later call `upgradeToAndCall`. The deployer becomes the contract owner
and is therefore the only account that can call `createMarket`,
`settleMarket`, `setFeeBps`, `withdrawFees`, or push upgrades — in production
this should be the cron wallet (see `packages/cron`), and ideally a multisig
sits behind upgrade rights specifically.

## Deploying to Robinhood Chain mainnet

```bash
USDC_ADDRESS=0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168 \
  forge script script/Deploy.s.sol --rpc-url $ROBINHOOD_RPC_URL --broadcast --verify
```

Setting `USDC_ADDRESS` (real USDG — "Global Dollar" — on Robinhood Chain
mainnet) skips deploying/minting `MockUSDC` entirely and uses that address as
the fixed collateral token instead. Without it, `Deploy.s.sol` always deploys
a fresh mock, which is only appropriate for local/testnet use.

No real network parameters for Robinhood Chain are hardcoded anywhere in this
repo — get the RPC URL from Robinhood Chain's own docs/explorer. See
[`DOCS.md`](../../DOCS.md#moving-to-robinhood-chain-mainnet) for wiring the
proxy address into `packages/cron` and `packages/web` afterward.

## Upgrading a deployed instance

Write a new implementation contract extending `MarketFactory`, deploy it, then
call `upgradeToAndCall(newImplementation, "")` as the owner. See
`test/MarketFactory.t.sol`'s `test_UpgradeToAndCall_*` tests for the pattern
this should follow (including asserting existing market state survives
unchanged).
