"use client";

import { useState } from "react";

/** A monospace address with a click-to-copy affordance — briefly confirms
 * with "Copied" instead of relying on a toast/notification system this app
 * doesn't otherwise have. */
export function CopyableAddress({ address, className = "" }: { address: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copy address"
      className={`inline-flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-1.5 font-mono text-xs text-foreground hover:border-foreground/40 transition-colors ${className}`}
    >
      <span className="truncate">{address}</span>
      <span className="shrink-0 text-muted-foreground">{copied ? "Copied ✓" : "Copy"}</span>
    </button>
  );
}
