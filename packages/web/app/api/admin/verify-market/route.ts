import { NextResponse } from "next/server";
import { createPublicClient, http, recoverMessageAddress } from "viem";
import { activeChain } from "@/lib/chains";
import { marketFactoryContract } from "@/lib/contracts";
import { verificationMessage, MAX_SIGNATURE_AGE_MS } from "@/lib/adminVerifyMessage";
import { setMarketVerified } from "@/lib/verifiedMarkets";

const publicClient = createPublicClient({ chain: activeChain, transport: http() });

// There's no session/login system in this app — everywhere else, "admin" is
// defined purely as "the connected wallet address equals the on-chain
// contract owner()" (see admin/page.tsx, SettleActions.tsx). This route
// applies the same trust model server-side: the caller signs a message with
// their wallet, we recover the signer address from that signature, and
// check it against owner() ourselves rather than trusting a client-supplied
// address.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const marketId = body?.marketId;
  const verified = body?.verified;
  const timestamp = body?.timestamp;
  const signature = body?.signature;

  if (
    typeof marketId !== "string" ||
    typeof verified !== "boolean" ||
    typeof timestamp !== "number" ||
    typeof signature !== "string"
  ) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (Math.abs(Date.now() - timestamp) > MAX_SIGNATURE_AGE_MS) {
    return NextResponse.json({ error: "Signature expired — try again." }, { status: 401 });
  }

  const message = verificationMessage(marketId, verified, timestamp);
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
    await setMarketVerified(marketId, verified);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to save." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
