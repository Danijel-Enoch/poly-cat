import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { Providers } from "./providers";
import { ConnectButton } from "@/components/ConnectButton";
import { PageTransition } from "@/components/PageTransition";
import { AmbientBackground } from "@/components/AmbientBackground";
import { ThemeToggle } from "@/components/ThemeToggle";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HoodMarkets",
  description: "The first permissionless prediction market on Robinhood Chain.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        <AmbientBackground />
        <Providers>
          <header className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
              <nav className="flex items-center gap-4 sm:gap-6 overflow-x-auto">
                <Link href="/" className="flex items-center gap-2 shrink-0">
                  <span className="h-7 w-7 rounded-full bg-accent flex items-center justify-center text-gray-900 text-sm font-bold">
                    H
                  </span>
                  <span className="font-extrabold tracking-tight text-lg hidden sm:inline">HoodMarkets</span>
                </Link>
                <Link href="/" className="shrink-0 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-950 dark:hover:text-white">
                  Markets
                </Link>
                <Link href="/leaderboard" className="shrink-0 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-950 dark:hover:text-white">
                  Leaderboard
                </Link>
                <Link href="/portfolio" className="shrink-0 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-950 dark:hover:text-white">
                  Portfolio
                </Link>
                <Link href="/docs" className="shrink-0 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-950 dark:hover:text-white">
                  Docs
                </Link>
              </nav>
              <div className="flex items-center gap-3 shrink-0">
                <Link
                  href="/create"
                  aria-label="Create Market"
                  className="flex items-center justify-center h-9 w-9 sm:h-auto sm:w-auto sm:px-4 sm:py-2 text-sm font-semibold rounded-full bg-accent text-gray-900 hover:bg-accent-dark transition-colors"
                >
                  <span className="sm:hidden text-lg leading-none">+</span>
                  <span className="hidden sm:inline">Create Market</span>
                </Link>
                <ThemeToggle />
                <ConnectButton />
              </div>
            </div>
          </header>
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
            <PageTransition>{children}</PageTransition>
          </main>
        </Providers>
      </body>
    </html>
  );
}
