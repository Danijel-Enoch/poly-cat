/** DexScreener's own embeddable chart widget — used for every DexScreener-
 * sourced (memecoin) market instead of the hand-rolled SVG chart, since
 * DexScreener's public API exposes current pair state but no historical
 * candles endpoint to build a custom chart from (see the price API route's
 * comment). `?embed=1` is DexScreener's documented lightweight-widget mode:
 * no site nav/header, just the chart. */
export function DexScreenerEmbed({ pairAddress }: { pairAddress: string }) {
  const pageUrl = `https://dexscreener.com/robinhood/${pairAddress}`;
  const embedSrc = `${pageUrl}?embed=1&theme=dark&trades=0&info=0`;

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <h2 className="font-bold text-gray-100">Price</h2>
        <a
          href={pageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-500 hover:text-gray-300"
        >
          View on DexScreener ↗
        </a>
      </div>
      <div className="relative w-full" style={{ paddingBottom: "60%" }}>
        <iframe
          src={embedSrc}
          className="absolute inset-0 h-full w-full border-0"
          title="DexScreener price chart"
        />
      </div>
    </div>
  );
}
