import { NextResponse } from "next/server";
import { createPublicClient, http, recoverMessageAddress } from "viem";
import { activeChain } from "@/lib/chains";
import { marketFactoryContract } from "@/lib/contracts";
import { importRequestMessage } from "@/lib/adminImportMessage";
import { MAX_SIGNATURE_AGE_MS } from "@/lib/adminVerifyMessage";
import { buildImportPlan } from "@/lib/marketImport";

const publicClient = createPublicClient({ chain: activeChain, transport: http() });

// Same trust model as app/api/admin/verify-market: there's no session/login
// system, so "admin" means "recovers to the connected wallet that is also the
// contract's owner()". This route never signs or sends a transaction itself —
// it only proposes candidates (see lib/marketImport.ts); the browser signs
// each createMarket call with the admin's own wallet after reviewing them.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const count = body?.count;
  const timestamp = body?.timestamp;
  const signature = body?.signature;

  if (
    !(count === null || typeof count === "number") ||
    typeof timestamp !== "number" ||
    typeof signature !== "string"
  ) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (Math.abs(Date.now() - timestamp) > MAX_SIGNATURE_AGE_MS) {
    return NextResponse.json({ error: "Signature expired — try again." }, { status: 401 });
  }

  const message = importRequestMessage(count, timestamp);
  let signer: `0x${string}`;
  try {
    signer = await recoverMessageAddress({ message, signature: signature as `0x${string}` });
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  const owner = await publicClient.readContract({ ...marketFactoryContract, functionName: "owner" });
  if (signer.toLowerCase() !== owner.toLowerCase()) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  try {
    const plan = await buildImportPlan(signer, count);
    return NextResponse.json({
      candidates: plan.candidates,
      maxAffordable: plan.maxAffordable,
      liquidityPerMarket: plan.liquidityPerMarket.toString(),
      collateralToken: plan.collateralToken,
      usdcBalance: plan.usdcBalance.toString(),
      ethBalance: plan.ethBalance.toString(),
      lowEthWarning: plan.lowEthWarning,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to build import plan." }, { status: 500 });
  }
}
