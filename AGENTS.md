# AGENTS.md

Guidance for ZCode agents working in this repo. Read this before making changes.

## What this is

**Polycat** — fixed 5-minute Up/Down prediction markets on an owner-curated asset
list (BTC/ETH/SOL priced via Gate.com; Robinhood Chain memecoins priced via
DexScreener). Trading is **native ETH only** (no collateral/ERC20 token, no
approval step — `buyShares`/`createMarket` are `payable`). Positioned on
**Robinhood Chain** (Arbitrum-based L2), also runs against local Anvil.

This is a **pnpm workspace monorepo** (`pnpm@9.15.0`) with three packages:

- `packages/contracts` — Foundry/Solidity: `MarketFactory`, a single UUPS
  (`ERC1967Proxy`) upgradeable contract holding every asset's curve + settlement.
- `packages/cron` — stateless Node/`tsx` script (`src/run.ts`). The cron wallet
  **is the contract owner**: it's the only account that opens/settles markets and
  registers assets. One pass then exits; meant for a real crontab (~30–60s).
- `packages/web` — Next.js 16 (App Router) + React 19 + wagmi 3 + viem 2 +
  Tailwind v4 + Vitest. Direct on-chain reads, **no indexer**.

Start with `README.md` (quickstart) and `DOCS.md` (full architecture: pricing
math, fee model, settlement rule, upgrade flow, mainnet migration) before
touching anything beyond trivial edits.

## Commands (run from repo root)

```bash
pnpm install                 # all packages share one install

# Contracts (Foundry — no package.json in this package)
pnpm contracts:build         # forge build
pnpm contracts:test          # forge test -vvv
pnpm contracts:deploy        # forge script script/Deploy.s.sol --broadcast

# Web
pnpm web:dev                 # next dev (:3000)
pnpm web:build               # next build
pnpm web:test                # vitest run   ← also runs on pre-push (husky)

# Cron
pnpm cron:run                # one pass: opens missing windows, settles closed ones

# Per-package checks (run inside that package's dir)
cd packages/web && pnpm lint      # eslint (flat config, eslint.config.mjs)
cd packages/cron && pnpm typecheck # tsc --noEmit (cron has no test runner)
```

`packages/contracts` has **no `package.json`** — it's Foundry-only. Use `forge`
directly or the `pnpm contracts:*` root scripts. OpenZeppelin contracts come via
a **git submodule** (`packages/contracts/lib/openzeppelin-contracts-upgradeable`);
run `git submodule update --init --recursive` on a fresh clone.

Local flow needs `anvil` running, then `pnpm contracts:deploy`, then one
`pnpm cron:run` to open initial windows, then `pnpm web:dev`. Each package has its
own `.env.local` (copy from `.env.example`); **never commit `.env*` files**.

## Architecture boundaries (important)

The same business logic exists in **three places that must stay in sync**:

1. **`packages/contracts/src/libraries/PythagoreanMath.sol`** — the on-chain curve
   (`reserve = c·√(upSupply² + downSupply²)`). Source of truth.
2. **`packages/web/lib/curveMath.ts`** — bit-exact TS mirror for client-side trade
   previews (incl. inverting `quoteBuy` to solve for ETH needed for a target share
   count — the contract has no view for that). The on-chain call is still
   authoritative; this only prefills the UI.
3. **`packages/cron/src/*`** — drives market lifecycle via `createMarket` /
   `settleMarket`, passing the observed close price through to the contract.

When changing pricing math, market duration, fee handling, or the
`PriceSource`/`MarketState` enums, **update all relevant layers together**. The
`enum` order must match exactly across Solidity and TS (they're ABI-encoded as a
plain `uint8` index):

- `PriceSource`: `Gate=0`, `DexScreener=1` (see `config.ts`, `chainReads.ts`,
  `MarketFactory.sol`).
- `MarketState`: `Trading`, `Finalized`, `Cancelled`.

**Market duration is fixed at 5 minutes** (`MARKET_DURATION_SECONDS = 5*60` in
both `packages/cron/src/config.ts` and `packages/web/lib/chainReads.ts`;
`MIN_TRADING_DURATION = 4 minutes` in the contract is only a floor). The 30m/1h
timeframes were deliberately dropped — don't reintroduce variable durations.

**Cron ordering invariant** (`src/run.ts`): always **settle** an asset's current
market (if its window closed) *before* opening the next one. That's the only
thing keeping the script stateless/idempotent — don't reorder it.

**No indexer anywhere.** `packages/web/lib/chainReads.ts` reads the chain
directly. It deliberately avoids viem's `multicall` action (no Multicall3 on
fresh Anvil) and uses plain `Promise.all` over reads (transport `batch:true`
still coalesces). Trade-history reads are scoped to a market's own short lifetime.

## Conventions

- **Web import alias:** `@/*` → repo-root-relative (`packages/web/tsconfig.json`
  `paths`). Files under `packages/web` import `@/lib/...`, `@/components/...`.
- **Cron imports use explicit `.js` extensions** (`./abi.js`) despite being `.ts`
  files — ESM/`tsx` requirement. Don't drop them.
- **Strict TypeScript** everywhere (`"strict": true`); no `any`-heavy patterns.
  BigInt is the norm for all on-chain amounts (`WAD = 1e18`).
- **Comments carry the "why."** This repo leans on long doc-comments explaining
  non-obvious invariants (env-var hygiene, the settle-before-open ordering, why no
  multicall/indexer). Match that density when adding to sensitive areas; don't
  strip explanatory comments.
- **Native ETH denomination** is assumed everywhere — there's no
  collateral-token concept to wire up. `COLLATERAL_SYMBOL = "ETH"` (`lib/contracts.ts`).

## Env vars & network switching

Everything chain-specific (chain ID, RPC, contract address) is **env-driven with
no hardcoded mainnet fallback** — switching networks never needs a code change.
Set `NEXT_PUBLIC_NETWORK=mainnet` + the `NEXT_PUBLIC_MAINNET_*` vars in the web
app, and `RPC_URL`/`CHAIN_ID` in cron.

Deliberate fail-loud behavior (preserve it):
- `lib/contracts.ts` trims + re-checksums address env vars (hosting dashboards
  paste stray whitespace) and throws on invalid/missing mainnet contract address.
- `packages/cron/src/config.ts` `requireEnv()` throws on missing required vars.

Caveat: only `NEXT_PUBLIC_MAINNET_MARKET_FACTORY_ADDRESS` throws at startup if
missing; other `NEXT_PUBLIC_MAINNET_*` vars silently fall back or misconfigure —
don't "fix" this without reading `lib/chains.ts` / `lib/contracts.ts` first.

## Gotchas

- **`packages/contracts/lib/openzeppelin-contracts-upgradeable` is a git
  submodule.** A fresh clone without `--recurse-submodules` will fail `forge build`.
- **`packages/contracts` has no `package.json`** — don't try `pnpm` commands
  inside it; use `forge` or root `pnpm contracts:*`.
- **Deploy logs the *proxy* address**, not the implementation — that's the address
  every other package needs (`MARKET_FACTORY_ADDRESS` in cron,
  `NEXT_PUBLIC_MARKET_FACTORY_ADDRESS` in web).
- **Cron private key must be the contract's current `owner()`**, and that wallet
  must hold enough ETH for gas *and* each new market's seed liquidity
  (`createMarket` sends `defaultInitialLiquidity` as `msg.value` from it).
- **Admin dashboard** (`/admin`) is gated to the wallet matching `owner()`.
- **Husky `pre-push` runs `pnpm web:test`** — keep web tests green before pushing.
- **`tsconfig.tsbuildinfo` / `.next/` / `out/` / `packages/contracts/{cache,out,broadcast}`**
  are build artifacts (gitignored) — don't edit or commit them.

## Before changing sensitive areas

- **Pricing/curve math:** read `DOCS.md` "Pricing" section + `PythagoreanMath.sol`
  + `curveMath.ts`, and update all three layers + the fuzz/invariant tests
  (`packages/contracts/test/`).
- **Settlement/upgrade flow:** read `DOCS.md` "Settlement" + "Upgradeability" +
  `script/Deploy.s.sol` / `script/Upgrade.s.sol`.
- **Mainnet migration:** read `DOCS.md` "Moving to Robinhood Chain mainnet".
- **Adding assets:** assets are admin-registered on-chain (`registerAsset`),
  surfaced via the admin dashboard's search (DexScreener for Robinhood Chain
  pairs, Gate.com for CEX tokens) — **not hardcoded** anywhere.
