import { NextRequest } from "next/server";

// Server-side proxy to packages/indexer's Ponder GraphQL API — same "sidestep
// CORS, keep the source in one place" rationale as app/api/price/[assetId]'s
// Gate.com proxy. Also the only thing that makes the indexer reachable at all
// from a browser hitting this app through a forwarded dev URL (Codespaces,
// tunnels, etc.): the indexer's own port is never itself exposed, so there's
// no separate port-visibility/CORS setup to get right in every environment
// this app runs in. lib/indexerApi.ts only routes browser-side calls through
// this route — server components/route handlers hit the indexer directly.
const PONDER_URL = process.env.PONDER_URL ?? process.env.NEXT_PUBLIC_PONDER_URL ?? "http://localhost:42069";

export async function POST(request: NextRequest) {
  const body = await request.text();

  let res: Response;
  try {
    res = await fetch(PONDER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      cache: "no-store",
    });
  } catch {
    return Response.json({ errors: [{ message: "Indexer unreachable" }] }, { status: 502 });
  }

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
