import { NextResponse } from "next/server";
import { createPublicClient, http, recoverMessageAddress } from "viem";
import { activeChain } from "@/lib/chains";
import { marketFactoryContract } from "@/lib/contracts";
import { researchMessage } from "@/lib/adminResearchMessage";
import { MAX_SIGNATURE_AGE_MS } from "@/lib/adminVerifyMessage";
import { getMarket } from "@/lib/ponder";
import { parseMetadataURI } from "@/lib/category";
import { researchMarketOutcome } from "@/lib/openrouter";

const publicClient = createPublicClient({ chain: activeChain, transport: http() });

// Same trust model as verify-market/delist-market: no session system, so
// "admin" is proven by recovering the signer of a fresh signed message and
// checking it against the contract's owner() ourselves. This route doesn't
// change any state, but it's still signature-gated because each call spends
// real OpenRouter budget — see lib/adminResearchMessage.ts.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const marketId = body?.marketId;
  const timestamp = body?.timestamp;
  const signature = body?.signature;

  if (typeof marketId !== "string" || typeof timestamp !== "number" || typeof signature !== "string") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (Math.abs(Date.now() - timestamp) > MAX_SIGNATURE_AGE_MS) {
    return NextResponse.json({ error: "Signature expired — try again." }, { status: 401 });
  }

  const message = researchMessage(marketId, timestamp);
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

  const market = await getMarket(marketId);
  if (!market) {
    return NextResponse.json({ error: "Market not found." }, { status: 404 });
  }

  const { title } = parseMetadataURI(market.metadataURI);
  const question = title || market.questionHash;

  try {
    const result = await researchMarketOutcome({ question, closeTimeSeconds: Number(market.closeTime) });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Research failed." }, { status: 500 });
  }
}
