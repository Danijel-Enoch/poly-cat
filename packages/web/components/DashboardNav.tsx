"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/Logo";
import { ConnectButton } from "@/components/ConnectButton";
import { AdminNavLink } from "@/components/AdminNavLink";
import { ThemeToggle } from "@/components/ThemeToggle";

// Real multi-route nav for the (dapp) screens — Optimus has no equivalent
// (it's a single-page marketing kit with anchor links only), so this
// translates its restrained/mono-label visual language into a persistent
// top bar instead of copying its scroll-shrinking single-page nav, which is
// used as-is on the landing page (components/landing/navigation.tsx).
const NAV_LINKS = [
  { href: "/app", label: "Markets" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/docs", label: "Docs" },
] as const;

function NavLinkItem({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`relative text-sm shrink-0 transition-colors group ${active ? "text-foreground" : "text-foreground/60 hover:text-foreground"}`}
    >
      {label}
      <span className={`absolute -bottom-1 left-0 h-px bg-foreground transition-all duration-300 ${active ? "w-full" : "w-0 group-hover:w-full"}`} />
    </Link>
  );
}

// The nav row below stays a single line at every width — same shape as
// launch.o1.exchange's own dashboard header, links included: at narrow
// widths the flex row runs out of room and later items just clip rather
// than wrapping or collapsing into a menu.
export function DashboardNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center gap-4 h-16">
          <Link href="/app" className="flex items-center gap-2 shrink-0">
            <Logo size={26} className="h-[26px] w-auto" />
            <span className="font-display text-xl tracking-tight text-foreground">Polycat</span>
          </Link>

          <nav className="flex items-center gap-6 min-w-0 overflow-hidden whitespace-nowrap">
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

          <div className="flex items-center gap-2 shrink-0 ml-auto">
            <ThemeToggle />
            <div className="w-40">
              <ConnectButton />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
