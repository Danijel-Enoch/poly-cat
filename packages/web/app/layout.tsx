import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { PageTransition } from "@/components/PageTransition";
import { AmbientBackground } from "@/components/AmbientBackground";
import { Sidebar } from "@/components/Sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-gray-950 text-gray-100">
        <AmbientBackground />
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
