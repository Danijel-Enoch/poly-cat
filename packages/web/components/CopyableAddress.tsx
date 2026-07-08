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
      className={`inline-flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 font-mono text-xs text-gray-200 hover:border-accent hover:text-accent transition-colors ${className}`}
    >
      <span className="truncate">{address}</span>
      <span className="shrink-0 text-gray-500">{copied ? "Copied ✓" : "Copy"}</span>
    </button>
  );
}
