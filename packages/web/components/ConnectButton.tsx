"use client";

import { ConnectButton as RainbowConnectButton } from "@rainbow-me/rainbowkit";
import { Button } from "@/components/ui/button";

// Wraps RainbowKit's actual wallet picker/account modal (ConnectButton.Custom
// render prop) with buttons styled onto the app's own tokens instead of
// RainbowKit's defaults — the picker itself is RainbowKit's own centered
// overlay, themed in app/providers.tsx. Same exported name/no-props API as
// before so callers need no changes.
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
              <Button onClick={openConnectModal} type="button" size="sm" className="w-full rounded-full">
                Connect
              </Button>
            ) : chain.unsupported ? (
              <Button onClick={openChainModal} type="button" variant="destructive" size="sm" className="w-full rounded-full">
                Wrong network
              </Button>
            ) : (
              <Button onClick={openAccountModal} type="button" variant="outline" size="sm" className="w-full rounded-full">
                {account.displayName}
              </Button>
            )}
          </div>
        );
      }}
    </RainbowConnectButton.Custom>
  );
}
