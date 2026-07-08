"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

import { Logo } from "@/components/Logo";
import { ConnectButton } from "@/components/ConnectButton";
import { AdminNavLink } from "@/components/AdminNavLink";

// Top-level nav. Admin is appended conditionally by <AdminNavLink /> (only the
// contract owner sees it). Kept in one place so the desktop sidebar and the
// mobile drawer render the exact same set of links.
const NAV_LINKS = [
  { href: "/app", label: "Markets", icon: <IconGrid /> },
  { href: "/portfolio", label: "Bag", icon: <IconWallet /> },
  { href: "/docs", label: "Docs", icon: <IconBook /> },
] as const;

function IconGrid() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function IconWallet() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1" />
      <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H5a2 2 0 0 1-2-2Z" />
      <circle cx="16.5" cy="13" r="1.25" />
    </svg>
  );
}

function IconBook() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2Z" />
      <path d="M4 19a2 2 0 0 1 2-2h12" />
    </svg>
  );
}

function IconX() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M13.6 10.6 20.8 2h-1.7l-6.2 7.5L7.9 2H2l7.5 10.9L2 22h1.7l6.6-8L15.9 22h5.9l-8.2-11.4Zm-2.3 2.8-.8-1.1L4.4 3.3h2.6l4.9 7 .8 1.1 6.4 9.2h-2.6l-5.2-7.2Z" />
    </svg>
  );
}

/** Social links row — currently just X/Twitter. A plain external link, not a
 * nav item, so it's styled and placed separately from NavList. */
function SocialLinks() {
  return (
    <a
      href="https://x.com/PolyCatsRobin"
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
    >
      <IconX />
      Follow on X
    </a>
  );
}

/** One nav link with active-state highlighting. `onNavigate` closes the mobile
 * drawer after a tap. */
function NavLinkItem({
  href,
  label,
  icon,
  pathname,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  pathname: string;
  onNavigate?: () => void;
}) {
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active ? "bg-gray-800 text-white" : "text-gray-300 hover:bg-gray-800 hover:text-white"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}

function NavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV_LINKS.map((link) => (
        <NavLinkItem key={link.href} href={link.href} label={link.label} icon={link.icon} pathname={pathname} onNavigate={onNavigate} />
      ))}
      {/* Owner-only; renders nothing unless the connected wallet is the contract
          owner. Styled in AdminNavLink.tsx to match the items above. */}
      <AdminNavLink pathname={pathname} onNavigate={onNavigate} />
    </nav>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop: persistent fixed left sidebar. */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-gray-800 bg-[#030200]/80 backdrop-blur-md px-4 py-5">
        <Link href="/app" className="flex items-center gap-2 px-2 mb-6">
          <Logo size={36} className="h-9 w-auto" />
          <span className="font-semibold tracking-tight text-lg">Polycat</span>
        </Link>
        <div className="flex-1">
          <NavList pathname={pathname} />
        </div>
        <SocialLinks />
        <div className="pt-4 border-t border-gray-800">
          <ConnectButton />
        </div>
      </aside>

      {/* Mobile: a slim top bar with a hamburger that opens a slide-in drawer.
          Replaces the old MobileNavMenu — same links as the desktop sidebar. */}
      <div className="lg:hidden sticky top-0 z-20 backdrop-blur-md border-b border-gray-800 bg-[#030200]/80">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/app" className="flex items-center gap-2">
            <Logo size={28} className="h-7 w-auto" />
            <span className="font-semibold tracking-tight">Polycat</span>
          </Link>
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex items-center justify-center h-9 w-9 rounded-full text-gray-300 hover:bg-gray-800"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
              {open ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6l-12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-30 bg-black/40 lg:hidden"
              onClick={() => setOpen(false)}
            />
            <motion.div
              key="drawer"
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", stiffness: 400, damping: 36 }}
              className="fixed inset-y-0 left-0 z-40 w-64 border-r border-gray-800 bg-gray-900 px-4 py-5 flex flex-col lg:hidden"
            >
              <Link href="/app" onClick={() => setOpen(false)} className="flex items-center gap-2 px-2 mb-6">
                <Logo size={36} className="h-9 w-auto" />
                <span className="font-semibold tracking-tight text-lg">Polycat</span>
              </Link>
              <div className="flex-1">
                <NavList pathname={pathname} onNavigate={() => setOpen(false)} />
              </div>
              <SocialLinks />
              <div className="pt-4 border-t border-gray-800">
                <ConnectButton />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
