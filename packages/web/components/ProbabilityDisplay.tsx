"use client";

import { AnimatePresence, motion } from "framer-motion";

export function ProbabilityDisplay({ upPct }: { upPct: number }) {
  return (
    <>
      <div className="text-right shrink-0 overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.p
            key={upPct}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            className="text-3xl font-display"
            style={{ color: upPct >= 50 ? "var(--up)" : "var(--down)" }}
          >
            {upPct}%
          </motion.p>
        </AnimatePresence>
        <p className="text-[11px] text-muted-foreground -mt-1">chance Up</p>
      </div>
    </>
  );
}

export function ProbabilityBar({ upPct }: { upPct: number }) {
  return (
    <div className="mt-4 h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <motion.div
        className="h-full rounded-full"
        style={{ background: "var(--up)" }}
        animate={{ width: `${upPct}%` }}
        transition={{ type: "spring", stiffness: 200, damping: 26 }}
      />
    </div>
  );
}
