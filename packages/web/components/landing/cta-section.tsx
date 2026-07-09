"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { AnimatedTetrahedron } from "./animated-tetrahedron";

export function CtaSection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && setIsVisible(true), { threshold: 0.2 });
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="relative py-24 lg:py-32 overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div
          className={`relative border border-foreground transition-all duration-1000 overflow-hidden ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <div className="absolute right-0 top-0 w-64 h-64 opacity-[0.08] pointer-events-none">
            <AnimatedTetrahedron />
          </div>

          <div className="relative z-10 px-8 lg:px-16 py-16 lg:py-24 flex flex-col items-start gap-8">
            <h2 className="text-4xl lg:text-6xl font-display tracking-tight text-balance max-w-2xl">
              Five minutes to your next call.
            </h2>
            <Link href="/app" className={cn(buttonVariants({ size: "xl" }), "group")}>
              Launch app
              <svg viewBox="0 0 24 24" className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
