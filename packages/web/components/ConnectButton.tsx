"use client";

import { ConnectButton as RainbowConnectButton } from "@rainbow-me/rainbowkit";

// Degen-styled trigger wrapping RainbowKit's actual wallet picker/account
// modal (ConnectButton.Custom render prop) — the picker itself is RainbowKit's
// own centered overlay, themed gold in app/providers.tsx. Keeping the same
// exported name/no-props API as before so Sidebar.tsx needs no changes.
export function ConnectButton() {
  return (
    <RainbowConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const ready = mounted;
        const connected = ready && !!account && !!chain;

        return (
          <div
            {...(!ready && {
              "aria-hidden": true,
              style: { opacity: 0, pointerEvents: "none", userSelect: "none" },
            })}
          >
            {!connected ? (
              <button
                onClick={openConnectModal}
                type="button"
                className="w-full text-sm font-bold px-4 py-2 rounded-full bg-accent text-gray-950 hover:bg-accent-dark glow-accent transition-colors"
              >
                Connect 🐒
              </button>
            ) : chain.unsupported ? (
              <button
                onClick={openChainModal}
                type="button"
                className="w-full text-sm font-bold px-4 py-2 rounded-full bg-rose-950 text-rose-400 border border-rose-900 hover:bg-rose-900 transition-colors"
              >
                Wrong network, ser
              </button>
            ) : (
              <button
                onClick={openAccountModal}
                type="button"
                className="w-full text-sm font-bold px-3 py-2 rounded-full border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors"
              >
                {account.displayName}
              </button>
            )}
          </div>
        );
      }}
    </RainbowConnectButton.Custom>
  );
}
