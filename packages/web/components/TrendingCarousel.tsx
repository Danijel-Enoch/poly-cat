"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { motion } from "framer-motion";
import type { MarketRow } from "@/lib/ponder";
import { formatCollateral, yesProbabilityFromSupplies } from "@/lib/format";
import { collateralDecimals, collateralSymbol } from "@/lib/contracts";
import { avatarColorFor } from "@/lib/avatarColor";
import { parseMetadataURI } from "@/lib/category";
import { ipfsImageUrl } from "@/lib/ipfs";

const TRENDING_COUNT = 5;

function TrendingCard({ market, index }: { market: MarketRow; index: number }) {
  const yesProb = yesProbabilityFromSupplies(market.yesSupply, market.noSupply);
  const yesPct = Math.round(yesProb * 100);
  const { category, image, title: parsedTitle } = parseMetadataURI(market.metadataURI);
  const title = parsedTitle || market.questionHash;
  const imageUrl = ipfsImageUrl(image);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.06, 0.3), ease: [0.16, 1, 0.3, 1] }}
      className="snap-start shrink-0 w-[260px] sm:w-[290px]"
    >
      <Link
        href={`/markets/${market.id}`}
        className="block h-full rounded-2xl border border-gray-800 bg-[#232810] p-4 hover:shadow-md hover:border-gray-600 transition-[box-shadow,border-color]"
      >
        <div className="flex items-start gap-3">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
          ) : (
            <span
              className={`h-10 w-10 shrink-0 rounded-full ${avatarColorFor(market.id)} flex items-center justify-center text-white font-bold text-sm`}
            >
              {title.replace("ipfs://", "").charAt(0).toUpperCase()}
            </span>
          )}
          <div className="flex-1 min-w-0">
            {category && (
              <span className="inline-block text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-accent/30 text-gray-200 mb-1">
                {category}
              </span>
            )}
            <p className="font-semibold text-[14px] leading-snug text-gray-100 line-clamp-2 break-words">{title}</p>
          </div>
        </div>

        <div className="mt-3 flex items-end justify-between">
          <span className={`text-2xl font-extrabold ${yesPct >= 50 ? "text-emerald-400" : "text-rose-400"}`}>
            {yesPct}%
          </span>
          <span className="text-[11px] text-gray-500">
            Vol {formatCollateral(market.volume, collateralDecimals(market.collateralToken))}{" "}
            {collateralSymbol(market.collateralToken)}
          </span>
        </div>

        <div className="mt-2 h-1.5 w-full rounded-full bg-gray-800 overflow-hidden">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${yesPct}%` }} />
        </div>
      </Link>
    </motion.div>
  );
}

export function TrendingCarousel({ markets }: { markets: MarketRow[] }) {
  const trending = [...markets]
    .filter((m) => m.state === "Trading")
    .sort((a, b) => (BigInt(a.volume) < BigInt(b.volume) ? 1 : -1))
    .slice(0, TRENDING_COUNT);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  function updateEdges() {
    const el = scrollerRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft >= el.scrollWidth - el.clientWidth - 4);
  }

  function scrollByCard(dir: 1 | -1) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 300, behavior: "smooth" });
  }

  if (trending.length === 0) return null;

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-400">Trending now</h2>
        <div className="hidden sm:flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Scroll left"
            onClick={() => scrollByCard(-1)}
            disabled={atStart}
            className="h-7 w-7 rounded-full flex items-center justify-center bg-gray-900 border border-gray-800 text-gray-300 disabled:opacity-30 hover:bg-gray-800 transition-colors"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Scroll right"
            onClick={() => scrollByCard(1)}
            disabled={atEnd}
            className="h-7 w-7 rounded-full flex items-center justify-center bg-gray-900 border border-gray-800 text-gray-300 disabled:opacity-30 hover:bg-gray-800 transition-colors"
          >
            ›
          </button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        onScroll={updateEdges}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-px-1 pb-1 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {trending.map((market, index) => (
          <TrendingCard key={market.id} market={market} index={index} />
        ))}
      </div>
    </div>
  );
}
