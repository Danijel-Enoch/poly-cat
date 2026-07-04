import { NextResponse } from "next/server";
import { createPublicClient, http, recoverMessageAddress } from "viem";
import { activeChain } from "@/lib/chains";
import { marketFactoryContract } from "@/lib/contracts";
import { delistMessage } from "@/lib/adminDelistMessage";
import { MAX_SIGNATURE_AGE_MS } from "@/lib/adminVerifyMessage";
import { setMarketDelisted } from "@/lib/delistedMarkets";

const publicClient = createPublicClient({ chain: activeChain, transport: http() });

// Same trust model as app/api/admin/verify-market: there's no session/login
// system, so "admin" is defined as "recovers to the connected wallet that is
// also the contract's owner()". Delisting only hides a market from the
// browse page (lib/delistedMarkets.ts) — it never touches the contract.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const marketId = body?.marketId;
  const delisted = body?.delisted;
  const timestamp = body?.timestamp;
  const signature = body?.signature;

  if (
    typeof marketId !== "string" ||
    typeof delisted !== "boolean" ||
    typeof timestamp !== "number" ||
    typeof signature !== "string"
  ) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (Math.abs(Date.now() - timestamp) > MAX_SIGNATURE_AGE_MS) {
    return NextResponse.json({ error: "Signature expired — try again." }, { status: 401 });
  }

  const message = delistMessage(marketId, delisted, timestamp);
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
    await setMarketDelisted(marketId, delisted);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to save." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
