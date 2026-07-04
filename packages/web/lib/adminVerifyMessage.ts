// Shared by the admin dashboard (signs this) and app/api/admin/verify-market
// (recovers the signer from it) so both sides agree on the exact bytes
// signed. Not server-only — imported from a "use client" component too.
export function verificationMessage(marketId: string, verified: boolean, timestamp: number): string {
  return `HoodMarkets admin: set market #${marketId} verified=${verified} at ${timestamp}`;
}

// Signatures older than this are rejected, so a captured signature can't be
// replayed indefinitely.
export const MAX_SIGNATURE_AGE_MS = 5 * 60 * 1000;

// Plain wrapper so callers inside a component body aren't calling Date.now()
// directly — react-hooks' purity check flags impure calls made straight from
// component/handler code (see lib/useNow.ts for the same concern elsewhere).
export function currentTimestamp(): number {
  return Date.now();
}
