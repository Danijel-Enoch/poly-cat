import { Card, CardContent } from "@/components/ui/card";

/** DexScreener's own embeddable chart widget — used for every DexScreener-
 * sourced (memecoin) market instead of the hand-rolled SVG chart, since
 * DexScreener's public API exposes current pair state but no historical
 * candles endpoint to build a custom chart from (see the price API route's
 * comment). `?embed=1` is DexScreener's documented lightweight-widget mode:
 * no site nav/header, just the chart. */
export function DexScreenerEmbed({ pairAddress }: { pairAddress: string }) {
  const pageUrl = `https://dexscreener.com/robinhood/${pairAddress}`;
  const embedSrc = `${pageUrl}?embed=1&theme=light&trades=0&info=0`;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="font-display text-lg">Price</h2>
          <a
            href={pageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            View on DexScreener ↗
          </a>
        </div>
        {/* Matches PriceHistoryChart.tsx's GateChart aspect ratio (440/640)
            so both chart paths give the page the same visual weight. */}
        <div className="relative w-full" style={{ paddingBottom: "68.75%" }}>
          <iframe
            src={embedSrc}
            className="absolute inset-0 h-full w-full border-0"
            title="DexScreener price chart"
          />
        </div>
      </CardContent>
    </Card>
  );
}
