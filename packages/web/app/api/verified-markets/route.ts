import { NextResponse } from "next/server";
import { getAllVerifiedMarketIds } from "@/lib/verifiedMarkets";

// Public and unauthenticated on purpose — verified status is shown on every
// market card, so it's not sensitive. Only *setting* it requires admin proof
// (see app/api/admin/verify-market).
export async function GET() {
  const verified = await getAllVerifiedMarketIds();
  return NextResponse.json({ verified });
}
