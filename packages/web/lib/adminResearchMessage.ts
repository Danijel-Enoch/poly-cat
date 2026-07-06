// Shared by the admin dashboard (signs this) and
// app/api/admin/research-market (recovers the signer from it) — see
// lib/adminVerifyMessage.ts for the identical pattern used by market
// verification, including MAX_SIGNATURE_AGE_MS and currentTimestamp, which
// this reuses rather than duplicating. Signature-gated (rather than left
// open) because each call spends real OpenRouter budget on a web-search
// request.
export function researchMessage(marketId: string, timestamp: number): string {
  return `HoodMarkets admin: research market #${marketId} outcome at ${timestamp}`;
}
