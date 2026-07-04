import { NextResponse } from "next/server";
import { getAllDelistedMarketIds } from "@/lib/delistedMarkets";

// Public and unauthenticated on purpose, matching app/api/verified-markets —
// the admin dashboard needs this to render its delist toggle state. Only
// *setting* it requires admin proof (see app/api/admin/delist-market).
export async function GET() {
  const delisted = await getAllDelistedMarketIds();
  return NextResponse.json({ delisted });
}
