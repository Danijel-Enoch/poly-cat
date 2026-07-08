# Polycat

Fixed 5-minute Up/Down markets on an open-ended, owner-curated list of
assets — "blue chip" tokens priced via Gate.com (BTC, ETH, SOL to start),
and Robinhood Chain memecoins priced via DexScreener (CashCat, the first
one). Pick an asset; its price when the window opens is the strike. Buy Up
or Down (or sell back) before it closes via a bonding-curve AMM — Down wins
if the close price is below the strike, Up wins if it's above, an exact
match is a push. Trading is entirely in native ETH — no approval step, no
separate collateral token. Positioned on **Robinhood Chain** (Robinhood's
Arbitrum-based L2).

- `packages/contracts` — Foundry smart contracts (`MarketFactory`, UUPS upgradeable)
- `packages/cron` — settlement/creation script: opens each new window and
  settles the previous one off a live price feed, on a schedule
- `packages/indexer` — Ponder indexer: full market history and per-wallet
  redeemable positions, for queries a direct chain read can't do cheaply
- `packages/web` — Next.js frontend

See [`DOCS.md`](./DOCS.md) for the full architecture writeup (pricing math,
fee model, settlement rule, deployment/upgrade flow, mainnet migration). This
file is a quickstart.

## How it works, briefly

- **Markets aren't user-created**, but assets are admin-added. `packages/cron`
  keeps every registered asset's 5-minute window running, opening the next
  wall-clock-aligned window the moment the previous one settles. Adding a new
  asset is a search-and-click action in the admin dashboard (DexScreener for
  Robinhood Chain pairs, Gate.com for centralized-exchange tokens) — the cron
  script picks it up automatically on its next pass.
- **Pricing**: each open window is its own automated market maker on a
  Pythagorean bonding curve (`reserve = c × √(upSupply² + downSupply²)`)
  rather than an order book or constant-product AMM — there's always a
  counterparty, even for the first trade in a brand-new window.
- **Trading**: everything is native ETH — buying is a single transaction
  (`buyShares` is `payable`), with no ERC20 approval step beforehand.
- **Fees**: a flat protocol trading fee (1% by default, owner-adjustable up
  to 5%) applies to every buy/sell, all of it going to the protocol
  treasury (windows are protocol-seeded, not user-seeded, so there's no
  creator to share it with).
- **Settlement**: fully automatic and mechanical. The cron script submits
  the asset's observed close price in one transaction; the contract compares
  it to the strike recorded at open and finalizes the outcome — no admin
  judgment call, no bond, no dispute window.
- **Upgradeability**: `MarketFactory` sits behind a UUPS (`ERC1967Proxy`)
  proxy, so logic can be upgraded later without migrating market state.

## Development

Prerequisites: [pnpm](https://pnpm.io) 9.x, [Foundry](https://book.getfoundry.sh/getting-started/installation), Node 18+.

```bash
pnpm install
```

Each package needs its own env file — copy the `.env.example` in each of
`packages/{contracts,cron,indexer,web}` to `.env.local` (`.env.local` for
contracts is optional; it defaults to Anvil's well-known account #0 key) and
fill in values as needed. Defaults are wired for the local flow below.

**1. Start a local chain and deploy the contracts:**

```bash
anvil                      # separate terminal, leave running
pnpm contracts:deploy      # forge script script/Deploy.s.sol --broadcast
```

Deploy logs the `MarketFactory` **proxy** address (not the implementation) —
that's the address every other package needs. It also registers the initial
asset list: BTC/ETH/SOL (Gate-sourced) and CashCat (DexScreener-sourced,
Robinhood Chain's first memecoin) — see `script/Deploy.s.sol`. Copy the
proxy address into `packages/cron/.env.local` (`MARKET_FACTORY_ADDRESS`),
`packages/indexer/.env.local` (`MARKET_FACTORY_ADDRESS`), and
`packages/web/.env.local` (`NEXT_PUBLIC_MARKET_FACTORY_ADDRESS`).

**2. Run the cron script once to open the first windows, then start the indexer and frontend:**

```bash
pnpm cron:run       # one pass: opens any missing windows, settles any closed ones
pnpm indexer:dev     # Ponder dev server at :42069 — powers browsing, admin history, redeemable positions
pnpm web:dev         # Next.js dev server at :3000
```

Re-run `pnpm cron:run` periodically (or set up a real crontab entry — see
`packages/cron/README.md`) to keep windows opening and settling as they
close.

**3. Run the contract test suite:**

```bash
pnpm contracts:test
```

## Deploying the cron script with Docker

```bash
docker build -t polycat-cron .
docker run --rm --env-file packages/cron/.env.local polycat-cron
```

This runs one pass and exits — schedule it with a real cron entry or
equivalent (a Kubernetes CronJob, etc.). See `packages/cron/README.md`.

## Deploying the indexer with Docker

```bash
docker build -f Dockerfile.indexer -t polycat-indexer .
docker run --rm -p 42069:42069 --env-file packages/indexer/.env.local polycat-indexer
```

Unlike the cron script, this is a long-lived process (`pnpm start`, not
`dev`) — it needs to stay running to keep serving fresh data, `DATABASE_SCHEMA`
set explicitly (`start` refuses to boot without it), and a real `DATABASE_URL`
(Postgres) so indexed history survives a restart. To use a different port,
set `PORT` in the env file (or `-e PORT=<port>`) and map the same port with
`-p` — see `packages/indexer/README.md`.

## Deploying the frontend

The web app deploys to Vercel like any Next.js app — set the env vars from
`packages/web/.env.example` in the project's dashboard. See `packages/web/README.md`.

## Moving to Robinhood Chain mainnet

Every mainnet-specific value (chain ID, RPC URL, contract address) is env-var
driven with no hardcoded fallback, so switching networks never requires a code
change:

1. Deploy `MarketFactory` to Robinhood Chain (`pnpm contracts:deploy` with
   `--rpc-url` pointed at it) and note the proxy address.
2. Fill in the `NEXT_PUBLIC_MAINNET_*` vars in `packages/web` and point
   `packages/cron`'s and `packages/indexer`'s `RPC_URL`/`CHAIN_ID` at
   Robinhood Chain, then set `NEXT_PUBLIC_NETWORK=mainnet` for the frontend.
   Set `packages/indexer`'s `START_BLOCK` to the deploy block from step 1 —
   indexing from 0 against a live chain scans every block back to genesis.
3. Redeploy all three. Missing a required mainnet var fails loudly at startup
   instead of silently pointing at the wrong chain — see `lib/contracts.ts`.

Full details in [`DOCS.md`](./DOCS.md#moving-to-robinhood-chain-mainnet).
