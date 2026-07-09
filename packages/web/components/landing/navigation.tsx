"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/cn";

const navLinks = [
  { name: "Markets", href: "#features" },
  { name: "How it works", href: "#how-it-works" },
  { name: "Fees", href: "#fees" },
  { name: "Docs", href: "/docs" },
];

/** Single-page anchor nav — floats into a shrinking rounded glass pill on
 * scroll, matching the Optimus reference exactly (this is the one place a
 * literal port makes sense, since the landing page genuinely is a single
 * scrolling page). The dashboard's real multi-route nav lives separately in
 * components/DashboardNav.tsx. */
export function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className={`fixed z-50 transition-all duration-500 ${isScrolled ? "top-4 left-4 right-4" : "top-0 left-0 right-0"}`}>
      <nav
        className={`mx-auto transition-all duration-500 ${
          isScrolled || isMobileMenuOpen
            ? "bg-background/80 backdrop-blur-xl border border-foreground/10 rounded-2xl shadow-lg max-w-[1200px]"
            : "bg-transparent max-w-[1400px]"
        }`}
      >
        <div className={`flex items-center justify-between transition-all duration-500 px-6 lg:px-8 ${isScrolled ? "h-14" : "h-20"}`}>
          <Link href="/" className="flex items-center gap-2 group">
            <Logo size={isScrolled ? 22 : 28} className="w-auto" />
            <span className={`font-display tracking-tight transition-all duration-500 ${isScrolled ? "text-xl" : "text-2xl"}`}>
              Polycat
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-10">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-sm text-foreground/70 hover:text-foreground transition-colors duration-300 relative group"
              >
                {link.name}
                <span className="absolute -bottom-1 left-0 w-0 h-px bg-foreground transition-all duration-300 group-hover:w-full" />
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-2">
            <Link
              href="/app"
              className={cn(
                buttonVariants({ size: "sm" }),
                "rounded-full transition-all duration-500",
                isScrolled ? "px-4 h-8 text-xs" : "px-6",
              )}
            >
              Trade now
            </Link>
            <ThemeToggle className="ml-1" />
          </div>

          <div className="flex items-center gap-1 md:hidden">
            <ThemeToggle />
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2" aria-label="Toggle menu">
              {isMobileMenuOpen ? (
                <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  <path d="M6 6l12 12M18 6l-12 12" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </nav>

      <div
        className={`md:hidden fixed inset-0 bg-background z-40 transition-all duration-500 ${
          isMobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        style={{ top: 0 }}
      >
        <div className="flex flex-col h-full px-8 pt-28 pb-8">
          <div className="flex-1 flex flex-col justify-center gap-8">
            {navLinks.map((link, i) => (
              <a
                key={link.name}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`text-5xl font-display text-foreground hover:text-muted-foreground transition-all duration-500 ${
                  isMobileMenuOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
                style={{ transitionDelay: isMobileMenuOpen ? `${i * 75}ms` : "0ms" }}
              >
                {link.name}
              </a>
            ))}
          </div>

          <div
            className={`flex gap-4 pt-8 border-t border-foreground/10 transition-all duration-500 ${
              isMobileMenuOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
            style={{ transitionDelay: isMobileMenuOpen ? "300ms" : "0ms" }}
          >
            <Link
              href="/app"
              onClick={() => setIsMobileMenuOpen(false)}
              className={cn(buttonVariants(), "flex-1 rounded-full h-14 text-base")}
            >
              Trade now
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
