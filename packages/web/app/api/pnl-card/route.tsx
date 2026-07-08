import { ImageResponse } from "next/og";
import { isAddress } from "viem";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";
import { fetchTraderStats, fetchTraderMarketCount, pnlFromTraderStats } from "@/lib/indexerApi";
import { formatEth, formatEthFull, shortenAddress } from "@/lib/format";
import { COLLATERAL_SYMBOL } from "@/lib/contracts";
import { SITE_NAME } from "@/lib/site";

// On-demand PnL share card, same 1200x630 branded-image technique as
// app/opengraph-image.tsx (brand tokens mirrored below). Deliberately not a
// page/opengraph-image.tsx pair for a public `/pnl/[address]` route: this is
// only ever fetched from inside the connected-wallet portfolio UI
// (components/PnlShareCard.tsx passes its own connected address), never
// linked from a page or <meta> tag, so it won't get crawled or unfurl on
// social the way the site-wide OG image does. The trader stats themselves
// are already public, on-chain, recomputable data — this route re-presents
// them, it doesn't gate anything a signature would meaningfully protect.
const BG = "#090303";
const ACCENT = "#FFD000"; // gold
const UP = "#00FF9D"; // pnl >= 0
const DOWN = "#FF2E88"; // pnl < 0
const FG = "#edebe3";
const MUTED = "rgba(237,235,227,0.6)";

async function loadPaw(): Promise<string | null> {
  try {
    const file = await readFile(path.join(process.cwd(), "public", "polycat-paw.png"));
    return `data:image/png;base64,${file.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");

  if (!address || !isAddress(address)) {
    return Response.json({ error: "A valid `address` query param is required" }, { status: 400 });
  }

  let stats, marketCount;
  try {
    [stats, marketCount] = await Promise.all([fetchTraderStats(address), fetchTraderMarketCount(address)]);
  } catch {
    return Response.json({ error: "Indexer unavailable" }, { status: 502 });
  }

  const pnl = pnlFromTraderStats(stats);
  const isProfit = pnl >= 0n;
  const pnlColor = isProfit ? UP : DOWN;
  const pnlSign = isProfit ? "+" : "-";
  const pnlAbs = isProfit ? pnl : -pnl;
  const totalVolume = stats.totalBought + stats.totalSold;
  const tradeCount = stats.buyCount + stats.sellCount;

  const paw = await loadPaw();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: BG,
          backgroundImage: `radial-gradient(900px 500px at 78% -10%, rgba(255,208,0,0.18), transparent 60%), radial-gradient(700px 500px at -5% 110%, ${
            isProfit ? "rgba(0,255,157,0.14)" : "rgba(255,46,136,0.14)"
          }, transparent 55%)`,
          padding: "72px 80px",
          color: FG,
          fontFamily: "sans-serif",
        }}
      >
        {/* Brand row */}
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {paw ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={paw} width={64} height={58} alt="" />
          ) : null}
          <span style={{ fontSize: 38, fontWeight: 700, letterSpacing: "-0.02em", color: FG }}>{SITE_NAME}</span>
          <div style={{ flex: 1 }} />
          <span
            style={{
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: "0.06em",
              color: ACCENT,
            }}
          >
            PNL CARD
          </span>
        </div>

        {/* Hero PnL number */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ display: "flex", fontSize: 30, fontWeight: 600, color: MUTED }}>
            {shortenAddress(address)}&apos;s all-time PnL
          </span>
          <span
            style={{
              display: "flex",
              fontSize: 108,
              fontWeight: 700,
              letterSpacing: "-0.04em",
              color: pnlColor,
            }}
          >
            {pnlSign}
            {formatEth(pnlAbs)} {COLLATERAL_SYMBOL}
          </span>
        </div>

        {/* Stat row */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <StatPill label="VOLUME TRADED" value={`${formatEthFull(totalVolume)} ${COLLATERAL_SYMBOL}`} />
          <StatPill label="TRADES" value={tradeCount.toLocaleString()} />
          <StatPill label="MARKETS" value={marketCount.toLocaleString()} />
          <div style={{ flex: 1 }} />
          <div
            style={{
              display: "flex",
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: "0.04em",
              color: ACCENT,
            }}
          >
            TRADE WITH ETH
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: "12px 24px",
        borderRadius: 16,
        border: "2px solid rgba(237,235,227,0.16)",
      }}
    >
      <span style={{ display: "flex", fontSize: 16, fontWeight: 700, letterSpacing: "0.06em", color: MUTED }}>
        {label}
      </span>
      <span style={{ display: "flex", fontSize: 28, fontWeight: 700, color: FG }}>{value}</span>
    </div>
  );
}
