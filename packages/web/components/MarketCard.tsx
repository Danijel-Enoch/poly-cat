"use client";

import Link from "next/link";
import { AnimatePresence, motion, useMotionValue, useSpring } from "framer-motion";
import type { MarketRow } from "@/lib/ponder";
import { formatUsdc, formatDate, yesProbabilityFromSupplies } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import { avatarColorFor } from "@/lib/avatarColor";
import { parseMetadataURI } from "@/lib/category";

export function MarketCard({ market, index = 0 }: { market: MarketRow; index?: number }) {
  const yesProb = yesProbabilityFromSupplies(market.yesSupply, market.noSupply);
  const yesPct = Math.round(yesProb * 100);
  const now = useNow();
  const isClosed = now / 1000 >= Number(market.closeTime);
  const { category, title: parsedTitle } = parseMetadataURI(market.metadataURI);
  const title = parsedTitle || market.questionHash;

  const rotateXRaw = useMotionValue(0);
  const rotateYRaw = useMotionValue(0);
  const rotateX = useSpring(rotateXRaw, { stiffness: 250, damping: 20 });
  const rotateY = useSpring(rotateYRaw, { stiffness: 250, damping: 20 });

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    rotateYRaw.set((px - 0.5) * 12);
    rotateXRaw.set((0.5 - py) * 12);
  }

  function handlePointerLeave() {
    rotateXRaw.set(0);
    rotateYRaw.set(0);
  }

  const statusBadge =
    market.state === "Finalized" ? (
      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 whitespace-nowrap">
        Resolved · {market.outcome ? "YES" : "NO"}
      </span>
    ) : isClosed ? (
      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 whitespace-nowrap">
        Closed
      </span>
    ) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.4), ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -3 }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={{ perspective: 800, rotateX, rotateY }}
    >
      <Link
        href={`/markets/${market.id}`}
        className="block rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-[box-shadow,border-color]"
      >
        <div className="flex items-start gap-3">
          <span
            className={`h-10 w-10 shrink-0 rounded-full ${avatarColorFor(market.id)} flex items-center justify-center text-white font-bold text-sm`}
          >
            {title.replace("ipfs://", "").charAt(0).toUpperCase()}
          </span>
          <div className="flex-1 min-w-0">
            {category && (
              <span className="inline-block text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-accent/30 text-gray-700 dark:text-gray-200 mb-1">
                {category}
              </span>
            )}
            <p className="font-semibold text-[15px] leading-snug text-gray-900 dark:text-gray-100 line-clamp-2">{title}</p>
          </div>
          <div className="text-right shrink-0 overflow-hidden">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.p
                key={yesPct}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.2 }}
                className={`text-2xl font-extrabold ${yesPct >= 50 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
              >
                {yesPct}%
              </motion.p>
            </AnimatePresence>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 -mt-1">chance</p>
          </div>
        </div>

        <div className="mt-3 h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-emerald-500"
            animate={{ width: `${yesPct}%` }}
            transition={{ type: "spring", stiffness: 200, damping: 26 }}
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <span className="text-center text-sm font-semibold rounded-lg py-2 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900">
            Buy Yes · {yesPct}¢
          </span>
          <span className="text-center text-sm font-semibold rounded-lg py-2 bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
            Buy No · {100 - yesPct}¢
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>Vol {formatUsdc(market.volume)} USDC</span>
          {statusBadge ?? <span>Closes {formatDate(market.closeTime)}</span>}
        </div>
      </Link>
    </motion.div>
  );
}
