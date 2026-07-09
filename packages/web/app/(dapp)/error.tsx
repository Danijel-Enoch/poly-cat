"use client";

import { useEffect } from "react";

/** Catches runtime errors anywhere under the (dapp) route group — most
 * commonly a chain read failing because no RPC is reachable yet (e.g. a
 * fresh deploy that hasn't been pointed at a live chain). Shows a plain
 * explanation instead of the framework's default crash screen. */
export default function DappError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="max-w-lg mx-auto rounded-xl border border-border bg-card p-8 text-center">
      <p className="text-foreground font-medium mb-2">Couldn&apos;t load market data.</p>
      <p className="text-muted-foreground text-sm mb-4">
        This usually means the app isn&apos;t pointed at a reachable chain yet, or the RPC endpoint is down.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium px-4 py-2"
      >
        Try again
      </button>
    </div>
  );
}
