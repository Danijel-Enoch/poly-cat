// Shared by the admin dashboard (signs this) and
// app/api/admin/delist-market (recovers the signer from it) — see
// lib/adminVerifyMessage.ts for the identical pattern used by market
// verification, including MAX_SIGNATURE_AGE_MS and currentTimestamp, which
// this reuses rather than duplicating.
export function delistMessage(marketId: string, delisted: boolean, timestamp: number): string {
  return `HoodMarkets admin: set market #${marketId} delisted=${delisted} at ${timestamp}`;
}
