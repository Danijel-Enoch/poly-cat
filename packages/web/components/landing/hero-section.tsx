"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { fetchProtocolStats } from "@/lib/indexerApi";
import { formatEthFull } from "@/lib/format";
import { COLLATERAL_SYMBOL } from "@/lib/contracts";
import { buttonVariants } from "@/components/ui/button";
import { AnimatedSphere } from "./animated-sphere";
import { cn } from "@/lib/cn";

const words = ["predict", "trade", "settle", "call"];

export function HeroSection() {
  const [wordIndex, setWordIndex] = useState(0);

  const { data: stats } = useQuery({
    queryKey: ["protocolStats"],
    queryFn: fetchProtocolStats,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % words.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const marqueeStats = [
    { value: "5 min", label: "window length" },
    { value: "1%", label: "flat trading fee" },
    { value: stats ? `${formatEthFull(stats.totalVolume)}` : "—", label: `${COLLATERAL_SYMBOL} traded all-time` },
    { value: stats ? stats.totalTrades.toLocaleString() : "—", label: "trades settled" },
  ];

  return (
    <section className="relative min-h-screen flex flex-col overflow-hidden">
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[600px] h-[600px] lg:w-[800px] lg:h-[800px] opacity-40 pointer-events-none">
        <AnimatedSphere />
      </div>

      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
        {[...Array(8)].map((_, i) => (
          <div key={`h-${i}`} className="absolute h-px bg-foreground/10" style={{ top: `${12.5 * (i + 1)}%`, left: 0, right: 0 }} />
        ))}
        {[...Array(12)].map((_, i) => (
          <div key={`v-${i}`} className="absolute w-px bg-foreground/10" style={{ left: `${8.33 * (i + 1)}%`, top: 0, bottom: 0 }} />
        ))}
      </div>

      <div className="relative z-10 flex-1 flex flex-col justify-center max-w-[1400px] mx-auto px-6 lg:px-12 py-32 lg:py-40">
        <div className="mb-8 animate-fade-up">
          <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground">
            <span className="w-8 h-px bg-foreground/30" />
            Fixed 5-minute markets, native ETH
          </span>
        </div>

        <div className="mb-12">
          <h1
            className="text-[clamp(3rem,12vw,10rem)] font-display leading-[0.9] tracking-tight animate-fade-up"
            style={{ animationDelay: "100ms" }}
          >
            <span className="block">The market to</span>
            <span className="block">
              <span className="relative inline-block">
                <span key={wordIndex} className="inline-flex">
                  {words[wordIndex].split("").map((char, i) => (
                    <span key={`${wordIndex}-${i}`} className="inline-block animate-char-in" style={{ animationDelay: `${i * 50}ms` }}>
                      {char}
                    </span>
                  ))}
                </span>
                <span className="absolute -bottom-2 left-0 right-0 h-3 bg-foreground/10" />
              </span>
            </span>
          </h1>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-end">
          <p
            className="text-xl lg:text-2xl text-muted-foreground leading-relaxed max-w-xl animate-fade-up"
            style={{ animationDelay: "200ms" }}
          >
            Pick a token, pick a side. Every market runs exactly five minutes and settles automatically off a live
            price feed — no order book, no dispute window, no approvals.
          </p>

          <div
            className="flex flex-col sm:flex-row items-start gap-4 animate-fade-up"
            style={{ animationDelay: "300ms" }}
          >
            <Link href="/app" className={cn(buttonVariants({ size: "xl" }), "group")}>
              Launch app
              <svg viewBox="0 0 24 24" className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <Link href="/docs" className={cn(buttonVariants({ variant: "outline", size: "xl" }), "border-foreground/20 hover:bg-foreground/5")}>
              Read the docs
            </Link>
          </div>
        </div>
      </div>

      <div className="relative z-10 pb-12 lg:pb-16 animate-fade-up" style={{ animationDelay: "500ms" }}>
        <div className="flex gap-16 marquee whitespace-nowrap">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex gap-16">
              {marqueeStats.map((stat) => (
                <div key={`${stat.label}-${i}`} className="flex items-baseline gap-4">
                  <span className="text-4xl lg:text-5xl font-display">{stat.value}</span>
                  <span className="text-sm text-muted-foreground">{stat.label}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
