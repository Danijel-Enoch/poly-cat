// Standalone CLI counterpart to app/api/admin/import-polymarket-markets +
// components/PolymarketImportPanel.tsx: fetches "major" Polymarket markets,
// has an LLM pick and categorize them (lib/marketImport.ts), and creates them
// on HoodMarkets directly from the terminal.
//
// Unlike the admin-dashboard flow (which signs with whichever wallet is
// connected in the browser), this script signs with its own PRIVATE_KEY env
// var and hard-fails if it's missing — same philosophy as
// packages/contracts/script/Upgrade.s.sol's vm.envUint for anything that
// touches funds.
//
// Usage: pnpm web:import-markets -- --count=5 [--yes]
//   --count=N   how many markets to create (omit to use as many as the
//               wallet's balance affords, capped at MAX_IMPORT_BATCH)
//   --yes       skip the confirmation prompt before sending transactions

import { createInterface } from "node:readline/promises";
import { createPublicClient, createWalletClient, http, keccak256, maxUint256, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { activeChain } from "../lib/chains";
import { marketFactoryContract, usdcContract, COLLATERAL_SYMBOL } from "../lib/contracts";
import { encodeMetadataURI } from "../lib/category";
import { formatUsdc, formatDate } from "../lib/format";
import { buildImportPlan } from "../lib/marketImport";

function parseArgs(argv: string[]): { count: number | null; yes: boolean } {
  let count: number | null = null;
  let yes = false;
  for (const arg of argv) {
    if (arg === "--yes") yes = true;
    else if (arg.startsWith("--count=")) count = Number(arg.slice("--count=".length));
  }
  return { count, yes };
}

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("PRIVATE_KEY must be set to run this script (see packages/web/.env.example).");
  }

  const { count, yes } = parseArgs(process.argv.slice(2));
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const publicClient = createPublicClient({ chain: activeChain, transport: http() });
  const walletClient = createWalletClient({ account, chain: activeChain, transport: http() });

  console.log(`Building import plan for ${account.address}...`);
  const plan = await buildImportPlan(account.address, count);

  console.log(
    `Balance: ${formatUsdc(plan.usdcBalance)} ${COLLATERAL_SYMBOL} — seeding each market with ` +
      `${formatUsdc(plan.liquidityPerMarket)} ${COLLATERAL_SYMBOL} (up to ${plan.maxAffordable} affordable).`,
  );
  if (plan.lowEthWarning) {
    console.log("Warning: ETH balance is low — you may not have enough for gas.");
  }

  if (plan.candidates.length === 0) {
    console.log("No new major markets to propose right now.");
    return;
  }

  console.log(`\nProposed markets (${plan.candidates.length}):`);
  plan.candidates.forEach((c, i) => {
    console.log(`  ${i + 1}. [${c.category}] ${c.question} (closes ${formatDate(BigInt(c.closeTimeSeconds))})`);
  });

  if (!yes) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question("\nCreate these markets on-chain? [y/N] ");
    rl.close();
    if (answer.trim().toLowerCase() !== "y") {
      console.log("Aborted.");
      return;
    }
  }

  const liquidityPerMarket = plan.liquidityPerMarket;
  const totalNeeded = liquidityPerMarket * BigInt(plan.candidates.length);

  const allowance = await publicClient.readContract({
    ...usdcContract,
    functionName: "allowance",
    args: [account.address, marketFactoryContract.address],
  });
  if (allowance < totalNeeded) {
    console.log(`Approving ${COLLATERAL_SYMBOL}...`);
    const approveHash = await walletClient.writeContract({
      ...usdcContract,
      functionName: "approve",
      args: [marketFactoryContract.address, maxUint256],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
  }

  let succeeded = 0;
  let failed = 0;
  for (const candidate of plan.candidates) {
    try {
      console.log(`Creating "${candidate.question}"...`);
      const hash = await walletClient.writeContract({
        ...marketFactoryContract,
        functionName: "createMarket",
        args: [
          {
            collateralToken: plan.collateralToken,
            questionHash: keccak256(toHex(candidate.question)),
            metadataURI: encodeMetadataURI(candidate.category, candidate.question),
            closeTime: BigInt(candidate.closeTimeSeconds),
            initialLiquidity: liquidityPerMarket,
          },
        ],
        value: 0n,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      console.log(`  done (${hash})`);
      succeeded += 1;
    } catch (err) {
      console.error(`  failed: ${err instanceof Error ? err.message : err}`);
      failed += 1;
    }
  }

  console.log(`\nCreated ${succeeded} market${succeeded === 1 ? "" : "s"}${failed > 0 ? `, ${failed} failed` : ""}.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
