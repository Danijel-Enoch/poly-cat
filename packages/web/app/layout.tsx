import type { Metadata } from "next";
import { Instrument_Sans, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "@rainbow-me/rainbowkit/styles.css";
import "./globals.css";
import { Providers } from "./providers";
import { PageTransition } from "@/components/PageTransition";
import {
  SITE_URL,
  SITE_NAME,
  SITE_TITLE,
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
} from "@/lib/site";

// Optimus font stack (see the design-system rebuild plan): Instrument Sans
// (body default), Instrument Serif (font-display — headlines, big numbers),
// JetBrains Mono (eyebrow labels, meta text). Via next/font/google, same as
// the previous font stack — no new deps, self-hosted.
const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
});
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
});
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

// metadataBase makes the generated og:image / canonical URLs absolute — social
// scrapers (Twitter/X, Telegram, WhatsApp, Discord, iMessage) reject relative
// image paths, so this is what makes a pasted link unfurl into a rich card.
// The og:image itself is produced by app/opengraph-image.tsx.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: SITE_KEYWORDS,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: "en_US",
  },
  twitter: {
    // "summary_large_image" is the wide card X/Twitter renders from og:image.
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    // site/creator: add the @handles here once the accounts exist, e.g.
    // site: "@polycat",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // next-themes sets the `dark` class on this element client-side (before
      // paint, via an inline script it injects) based on stored/system
      // preference — suppressHydrationWarning stops React from flagging that
      // as a server/client mismatch, which is expected here.
      suppressHydrationWarning
      className={`${instrumentSans.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans antialiased">
        <Providers>
          {/* No global chrome here — the landing page composes its own
              anchor-scroll <Navigation/> (components/landing/navigation.tsx),
              and (dapp) routes get their own multi-route <DashboardNav/> via
              app/(dapp)/layout.tsx. The two need genuinely different nav
              patterns (single-page anchors vs. real routes), so neither
              belongs at the root. */}
          <PageTransition>{children}</PageTransition>
        </Providers>
      </body>
    </html>
  );
}
