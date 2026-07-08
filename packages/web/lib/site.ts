/**
 * Canonical site metadata, shared by the root layout's <head> tags and the
 * generated Open Graph / Twitter share image. Social scrapers (Twitter/X,
 * Telegram, WhatsApp, iMessage, Discord, …) all read Open Graph `og:*` tags,
 * so getting these right is what makes a pasted link unfurl into a rich card.
 */

/**
 * Absolute origin used to make `og:image` / canonical URLs absolute — social
 * crawlers reject relative image paths. Resolution order:
 *   1. NEXT_PUBLIC_SITE_URL — set this to the public production origin.
 *   2. VERCEL_PROJECT_PRODUCTION_URL — Vercel injects the prod deployment host
 *      automatically, so previews/prod still unfurl without extra config.
 *   3. localhost — dev fallback.
 */
function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;

  return "http://localhost:3000";
}

export const SITE_URL = resolveSiteUrl();

export const SITE_NAME = "Polycat";

export const SITE_TITLE = "Polycat — Fixed 5-minute Up/Down markets";

export const SITE_DESCRIPTION =
  "Fixed 5-minute Up/Down markets on curated blue-chip and Robinhood Chain memecoin assets. Trade with ETH.";

export const SITE_KEYWORDS = [
  "Polycat",
  "prediction markets",
  "Up/Down markets",
  "crypto trading",
  "Robinhood Chain",
  "memecoin",
  "onchain",
  "ETH",
  "DeFi",
];
