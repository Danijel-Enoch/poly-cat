"use client";

import { AnimatePresence, motion } from "framer-motion";

export function ProbabilityDisplay({ yesPct }: { yesPct: number }) {
  return (
    <>
      <div className="text-right shrink-0 overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.p
            key={yesPct}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            className={`text-3xl font-extrabold ${yesPct >= 50 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
          >
            {yesPct}%
          </motion.p>
        </AnimatePresence>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 -mt-1">chance</p>
      </div>
    </>
  );
}

export function ProbabilityBar({ yesPct }: { yesPct: number }) {
  return (
    <div className="mt-4 h-2 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
      <motion.div
        className="h-full rounded-full bg-emerald-500"
        animate={{ width: `${yesPct}%` }}
        transition={{ type: "spring", stiffness: 200, damping: 26 }}
      />
    </div>
  );
}
