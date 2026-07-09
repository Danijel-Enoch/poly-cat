import Link from "next/link";

import { Logo } from "@/components/Logo";
import { AnimatedWave } from "./animated-wave";

const footerLinks = {
  Product: [
    { name: "Markets", href: "/app" },
    { name: "How it works", href: "/#how-it-works" },
    { name: "Fees", href: "/#fees" },
    { name: "Leaderboard", href: "/leaderboard" },
  ],
  Resources: [
    { name: "Docs", href: "/docs" },
    { name: "Security", href: "/#security" },
  ],
};

export function FooterSection() {
  return (
    <footer className="relative border-t border-border">
      <div className="absolute inset-0 h-64 opacity-20 pointer-events-none overflow-hidden">
        <AnimatedWave />
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="py-16 lg:py-24">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12 lg:gap-8">
            <div className="col-span-2">
              <Link href="/" className="flex items-center gap-2 mb-4">
                <Logo size={28} className="w-auto" />
                <span className="font-display text-2xl tracking-tight">Polycat</span>
              </Link>
              <p className="text-sm text-muted-foreground max-w-xs">
                Fixed 5-minute Up/Down markets, settled mechanically off a live price feed. Native ETH only.
              </p>
            </div>

            {Object.entries(footerLinks).map(([category, links]) => (
              <div key={category}>
                <h4 className="font-mono text-xs uppercase tracking-wide text-muted-foreground mb-4">{category}</h4>
                <ul className="flex flex-col gap-3">
                  {links.map((link) => (
                    <li key={link.name}>
                      <Link href={link.href} className="text-sm text-foreground/70 hover:text-foreground transition-colors">
                        {link.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="py-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Polycat</span>
          <a href="https://x.com/PolyCatsRobin" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
            Follow on X
          </a>
        </div>
      </div>
    </footer>
  );
}
