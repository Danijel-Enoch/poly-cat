import { NextRequest } from "next/server";
import { getInactiveAssetIds, setAssetActive } from "@/lib/assetStatusStore";

// Backs the admin dashboard's per-asset "pause new cycles" toggle (see
// app/(dapp)/admin/page.tsx and lib/assetStatusStore.ts) — no contract
// change, just a shared JSON file packages/cron also reads before opening a
// new market. No server-side wallet-signature auth here: gated the same way
// the rest of /admin already is, client-side by checking the connected
// address against the contract's `owner()`. That's a real gap for a public
// deployment (anyone who finds this route can toggle it), acceptable for
// now since this whole feature is local-dev-scoped (see assetStatusStore.ts).
export async function GET() {
  return Response.json({ inactiveAssetIds: await getInactiveAssetIds() });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { assetId?: string; active?: boolean };
  if (typeof body.assetId !== "string" || typeof body.active !== "boolean") {
    return Response.json({ error: "assetId (string) and active (boolean) are required" }, { status: 400 });
  }
  await setAssetActive(body.assetId, body.active);
  return Response.json({ inactiveAssetIds: await getInactiveAssetIds() });
}
