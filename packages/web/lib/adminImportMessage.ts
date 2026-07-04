// Shared by the admin dashboard (signs this) and
// app/api/admin/import-polymarket-markets (recovers the signer from it) — see
// lib/adminVerifyMessage.ts for the identical pattern used by market
// verification. Reuses that file's MAX_SIGNATURE_AGE_MS rather than
// duplicating the replay-window constant.
export function importRequestMessage(count: number | null, timestamp: number): string {
  return `HoodMarkets admin: import ${count == null ? "as many" : count} Polymarket markets as affordable at ${timestamp}`;
}
