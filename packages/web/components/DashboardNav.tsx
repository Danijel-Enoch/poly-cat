"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/Logo";
import { ConnectButton } from "@/components/ConnectButton";
import { AdminNavLink } from "@/components/AdminNavLink";
import { ThemeToggle } from "@/components/ThemeToggle";

function IconMenu(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" {...props}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function IconX(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" {...props}>
      <path d="M6 6l12 12M18 6l-12 12" />
    </svg>
  );
}

// Real multi-route nav for the (dapp) screens — Optimus has no equivalent
// (it's a single-page marketing kit with anchor links only), so this
// translates its restrained/mono-label visual language into a persistent
// top bar instead of copying its scroll-shrinking single-page nav, which is
// used as-is on the landing page (components/landing/navigation.tsx).
const NAV_LINKS = [
  { href: "/app", label: "Markets" },
  { href: "/prediction-markets", label: "Prediction Market" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/docs", label: "Docs" },
] as const;

function NavLinkItem({ href, label, active, onNavigate }: { href: string; label: string; active: boolean; onNavigate?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`relative text-sm shrink-0 transition-colors group ${active ? "text-foreground" : "text-foreground/60 hover:text-foreground"}`}
    >
      {label}
      <span className={`absolute -bottom-1 left-0 h-px bg-foreground transition-all duration-300 ${active ? "w-full" : "w-0 group-hover:w-full"}`} />
    </Link>
  );
}

export function DashboardNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    // The mobile menu below is a *sibling* of <header>, not nested inside it —
    // <header>'s backdrop-blur-xl (backdrop-filter) establishes a new
    // containing block for position:fixed descendants in Chromium/WebKit, so
    // a fixed "full-viewport" panel nested inside it ends up sized relative
    // to the header's own ~64px box instead of the viewport and collapses to
    // ~0 height. Keeping it a sibling avoids the header's filter context.
    <>
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-4 h-16">
            <Link href="/app" className="flex items-center shrink-0">
              <Logo variant="full" height={28} className="h-7 w-auto" />
            </Link>

            <nav className="hidden md:flex items-center gap-6 min-w-0">
              {NAV_LINKS.map((link) => (
                <NavLinkItem
                  key={link.href}
                  href={link.href}
                  label={link.label}
                  active={pathname === link.href || pathname.startsWith(link.href + "/")}
                />
              ))}
              <AdminNavLink pathname={pathname} />
            </nav>

            <div className="hidden md:flex items-center gap-2 shrink-0 ml-auto">
              <ThemeToggle />
              <div className="w-32">
                <ConnectButton />
              </div>
            </div>

            <div className="flex items-center gap-1 md:hidden ml-auto">
              <ThemeToggle />
              <button onClick={() => setOpen((v) => !v)} className="p-2 text-foreground" aria-label="Toggle menu" aria-expanded={open}>
                {open ? <IconX className="w-5 h-5" /> : <IconMenu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile menu — sibling of <header>, see the comment above.
          overflow-y-auto so the panel scrolls instead of clipping links
          below the fold on short/landscape viewports. */}
      <div
        className={`md:hidden fixed inset-0 top-16 bg-background z-40 overflow-y-auto transition-opacity duration-300 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex flex-col min-h-full px-6 pt-8 pb-8">
          <div className="flex-1 flex flex-col gap-6">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="text-3xl font-display text-foreground"
              >
                {link.label}
              </Link>
            ))}
            <AdminNavLink pathname={pathname} onNavigate={() => setOpen(false)} />
          </div>
          <div className="pt-6 border-t border-border">
            <ConnectButton />
          </div>
        </div>
      </div>
    </>
  );
}
