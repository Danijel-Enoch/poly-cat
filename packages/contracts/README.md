# HoodMarkets — contracts

Foundry project for `MarketFactory` — a permissionless prediction market
factory, Pythagorean bonding-curve AMM, and collateral custody hub, deployed
behind a UUPS (`ERC1967Proxy`) upgradeable proxy. See the repo root
[`DOCS.md`](../../DOCS.md) for the pricing math, fee split, settlement model,
and upgrade flow — this file covers just building/testing/deploying.

## Build & test

```bash
forge build
forge test          # full suite
forge test -vvv     # from the repo root: pnpm contracts:test
```

Test suite covers `MarketFactory.t.sol` (unit tests: trading, fees, creator fee
split, settlement, UUPS upgrades), `PythagoreanMath.t.sol` (fuzz tests on the
curve math itself: solvency, monotonicity, round-trip non-profitability), and
`test/invariant/MarketInvariants.t.sol` (a `Handler`-driven invariant test
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
(initialized with the deployer as owner). **The proxy address is what every
other package uses** (indexer, frontend) — the implementation address is only
needed if you later call `upgradeToAndCall`. The deployer becomes the contract
owner and is therefore the only account that can call `settleMarket`,
`setFeeBps`, `withdrawFees`, or push upgrades — reassign ownership to a
multisig before any real deployment.

## Deploying to Robinhood Chain mainnet

```bash
USDC_ADDRESS=0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168 \
  forge script script/Deploy.s.sol --rpc-url $ROBINHOOD_RPC_URL --broadcast --verify
```

Setting `USDC_ADDRESS` (real USDG — "Global Dollar" — on Robinhood Chain
mainnet) skips deploying/minting `MockUSDC` entirely and uses that address as
the collateral token instead. Without it, `Deploy.s.sol` always deploys a
fresh mock, which is only appropriate for local/testnet use.

No real network parameters for Robinhood Chain are hardcoded anywhere in this
repo — get the RPC URL from Robinhood Chain's own docs/explorer. See
[`DOCS.md`](../../DOCS.md#moving-to-robinhood-chain-mainnet) for wiring the
proxy address into the indexer and frontend afterward.

## Upgrading a deployed instance

Write a new implementation contract extending `MarketFactory`, deploy it, then
call `upgradeToAndCall(newImplementation, "")` as the owner. See
`test/MarketFactory.t.sol`'s `test_UpgradeToAndCall_*` tests for the pattern
this should follow (including asserting existing market state survives
unchanged).
