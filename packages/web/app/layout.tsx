import type { Metadata } from "next";
import { Chakra_Petch, Space_Grotesk, Space_Mono } from "next/font/google";
import "@rainbow-me/rainbowkit/styles.css";
import "./globals.css";
import { Providers } from "./providers";
import { PageTransition } from "@/components/PageTransition";
import { Sidebar } from "@/components/Sidebar";

// Degen font stack: Chakra Petch (angular cyberpunk display — headlines,
// buttons, labels), Space Grotesk (techy but readable body), Space Mono
// (terminal/ape mono). All via next/font/google — no new deps, self-hosted.
const chakraPetch = Chakra_Petch({
  variable: "--font-chakra-petch",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Polycat",
  description:
    "Fixed 5-minute Up/Down markets on curated blue-chip and Robinhood Chain memecoin assets. Trade with ETH.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${chakraPetch.variable} ${spaceGrotesk.variable} ${spaceMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-gray-950 text-gray-100">
        <Providers>
          {/* Sidebar is global (whole app, incl. the landing page) so chrome is
              consistent everywhere. Desktop: fixed left; the content area is
              offset by the sidebar's width. Mobile: a top bar + slide-in drawer
              rendered inside <Sidebar />, no fixed offset needed. */}
          <Sidebar />
          <div className="flex-1 flex flex-col min-h-screen lg:pl-64">
            <PageTransition>{children}</PageTransition>
          </div>
        </Providers>
      </body>
    </html>
  );
}
