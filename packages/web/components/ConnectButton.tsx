"use client";

import { useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Labels for wagmi's built-in connector ids — `injected` only works where a
// wallet extension injects `window.ethereum` (desktop browsers, mostly),
// `walletConnect` covers everything else via QR code or a mobile deep link.
const CONNECTOR_LABELS: Record<string, string> = {
  injected: "Browser wallet",
  walletConnect: "WalletConnect",
};

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [menuOpen, setMenuOpen] = useState(false);

  if (isConnected && address) {
    return (
      <button
        onClick={() => disconnect()}
        className="text-sm font-medium px-3 py-2 rounded-full border border-gray-700 text-gray-300 hover:bg-gray-800"
      >
        {shortenAddress(address)}
      </button>
    );
  }

  // Only one connector configured (typically local dev, with no WalletConnect
  // project ID set) — skip the picker and connect directly, same as before.
  if (connectors.length <= 1) {
    const connector = connectors[0];
    return (
      <button
        onClick={() => connector && connect({ connector })}
        disabled={!connector || isPending}
        className="text-sm font-semibold px-4 py-2 rounded-full bg-accent text-gray-950 hover:bg-accent-dark disabled:opacity-50"
      >
        {isPending ? "Connecting..." : "Connect Wallet"}
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen((open) => !open)}
        disabled={isPending}
        className="text-sm font-semibold px-4 py-2 rounded-full bg-accent text-gray-950 hover:bg-accent-dark disabled:opacity-50"
      >
        {isPending ? "Connecting..." : "Connect Wallet"}
      </button>
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 mt-2 w-48 rounded-xl border border-gray-700 bg-gray-800 shadow-lg z-20 overflow-hidden">
            {connectors.map((connector) => (
              <button
                key={connector.uid}
                onClick={() => {
                  setMenuOpen(false);
                  connect({ connector });
                }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-100 hover:bg-gray-700"
              >
                {CONNECTOR_LABELS[connector.id] ?? connector.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
