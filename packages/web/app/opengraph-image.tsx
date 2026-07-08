import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { SITE_NAME, SITE_DESCRIPTION } from "@/lib/site";

// Branded 1200×630 share card. This single file convention emits the
// `og:image` + `twitter:image` tags (with width/height/type) that every social
// scraper — Twitter/X, Telegram, WhatsApp, Discord, iMessage — reads to unfurl
// a pasted link into a rich preview.
export const alt = `${SITE_NAME} — Fixed 5-minute Up/Down markets`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Brand tokens, mirrored from app/globals.css so the card matches the site.
const BG = "#090303";
const ACCENT = "#FFD000"; // gold
const UP = "#00FF9D"; // Up = green
const DOWN = "#FF2E88"; // Down = hot pink
const FG = "#edebe3";

async function loadPaw(): Promise<string | null> {
  // Embed the real paw mark as a data URI; fall back to no logo if the file
  // can't be read so the card still renders rather than 500-ing.
  try {
    const file = await readFile(
      path.join(process.cwd(), "public", "polycat-paw.png"),
    );
    return `data:image/png;base64,${file.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function OpengraphImage() {
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
          backgroundImage: `radial-gradient(900px 500px at 78% -10%, rgba(255,208,0,0.18), transparent 60%), radial-gradient(700px 500px at -5% 110%, rgba(255,46,136,0.14), transparent 55%)`,
          padding: "72px 80px",
          color: FG,
          fontFamily: "sans-serif",
        }}
      >
        {/* Brand row */}
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {paw ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={paw} width={84} height={76} alt="" />
          ) : null}
          <span
            style={{
              fontSize: 52,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: FG,
            }}
          >
            {SITE_NAME}
          </span>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div
            style={{
              display: "flex",
              fontSize: 82,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              maxWidth: 940,
              color: FG,
            }}
          >
            Fixed 5-minute Up/Down markets
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 32,
              lineHeight: 1.35,
              maxWidth: 900,
              color: "rgba(237,235,227,0.7)",
            }}
          >
            {SITE_DESCRIPTION}
          </div>
        </div>

        {/* Up / Down pills + accent underline */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              fontSize: 30,
              fontWeight: 600,
              padding: "12px 28px",
              borderRadius: 9999,
              color: UP,
              border: `2px solid ${UP}`,
              background: "rgba(0,255,157,0.08)",
            }}
          >
            ▲ UP
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              fontSize: 30,
              fontWeight: 600,
              padding: "12px 28px",
              borderRadius: 9999,
              color: DOWN,
              border: `2px solid ${DOWN}`,
              background: "rgba(255,46,136,0.08)",
            }}
          >
            ▼ DOWN
          </div>
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
    { ...size },
  );
}
