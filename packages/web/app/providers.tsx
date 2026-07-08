"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { PonderProvider } from "@ponder/react";
import { WagmiProvider } from "wagmi";
import { useState } from "react";

import { wagmiConfig } from "@/lib/wagmi";
import { ponderClient } from "@/lib/ponder";

// Gold/neon degen theme for RainbowKit's own modal (wallet picker, account
// view, chain switcher) so it matches the app's palette (see app/globals.css)
// instead of RainbowKit's default blue.
const polycatRainbowTheme = darkTheme({
  accentColor: "#ffd000",
  accentColorForeground: "#090303",
  borderRadius: "large",
  fontStack: "system",
  overlayBlur: "small",
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <PonderProvider client={ponderClient}>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider theme={polycatRainbowTheme}>{children}</RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </PonderProvider>
  );
}
