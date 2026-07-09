"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, lightTheme, darkTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { useState } from "react";
import { ThemeProvider, useTheme } from "next-themes";

import { wagmiConfig } from "@/lib/wagmi";

// Same monochrome accent in both RainbowKit themes (see app/globals.css's
// --primary/--foreground for light/dark) so its modal (wallet picker,
// account view, chain switcher) matches the app's palette instead of
// RainbowKit's default blue, whichever mode is active.
const rainbowLight = lightTheme({
  accentColor: "#1f1a10",
  accentColorForeground: "#fcfbf8",
  borderRadius: "small",
  fontStack: "system",
  overlayBlur: "small",
});
const rainbowDark = darkTheme({
  accentColor: "#f0ede4",
  accentColorForeground: "#29251c",
  borderRadius: "small",
  fontStack: "system",
  overlayBlur: "small",
});

function RainbowKitThemedProvider({ children }: { children: React.ReactNode }) {
  // `resolvedTheme` is undefined until after mount (next-themes reads
  // localStorage/system preference client-side to avoid an SSR mismatch) —
  // default to the light theme for that first render, same as the rest of
  // the app already does before hydration settles.
  const { resolvedTheme } = useTheme();
  return (
    <RainbowKitProvider theme={resolvedTheme === "dark" ? rainbowDark : rainbowLight}>{children}</RainbowKitProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitThemedProvider>{children}</RainbowKitThemedProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  );
}
