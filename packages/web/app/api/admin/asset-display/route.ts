import { NextRequest } from "next/server";
import { getAssets } from "@/lib/chainReads";
import { getDelistedAssetIds, setAssetDelisted, getAssetOrder, moveAsset } from "@/lib/assetDisplayStore";

// Backs the admin dashboard's delist/relist toggle and reorder controls (see
// app/(dapp)/admin/page.tsx and lib/assetDisplayStore.ts). Same auth posture
// as /api/admin/asset-status: no server-side signature check, gated
// client-side by comparing the connected address against the contract's
// owner() — a real gap for a public deployment, acceptable for now since
// this whole feature is local-dev-scoped (see assetDisplayStore.ts).
async function allAssetIds(): Promise<string[]> {
  const assets = await getAssets();
  return assets.map((a) => a.id.toString());
}

export async function GET() {
  const ids = await allAssetIds();
  const [delistedAssetIds, order] = await Promise.all([getDelistedAssetIds(), getAssetOrder(ids)]);
  return Response.json({ delistedAssetIds, order });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    action?: "delist" | "move";
    assetId?: string;
    delisted?: boolean;
    direction?: "up" | "down";
  };
  const ids = await allAssetIds();

  if (body.action === "delist") {
    if (typeof body.assetId !== "string" || typeof body.delisted !== "boolean") {
      return Response.json({ error: "assetId (string) and delisted (boolean) are required" }, { status: 400 });
    }
    await setAssetDelisted(body.assetId, body.delisted);
  } else if (body.action === "move") {
    if (typeof body.assetId !== "string" || (body.direction !== "up" && body.direction !== "down")) {
      return Response.json({ error: "assetId (string) and direction ('up'|'down') are required" }, { status: 400 });
    }
    await moveAsset(body.assetId, body.direction, ids);
  } else {
    return Response.json({ error: "action must be 'delist' or 'move'" }, { status: 400 });
  }

  const [delistedAssetIds, order] = await Promise.all([getDelistedAssetIds(), getAssetOrder(ids)]);
  return Response.json({ delistedAssetIds, order });
}
