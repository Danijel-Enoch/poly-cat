/** Repurposed from the reference's tiered "Pricing" section — Polycat has
 * one honest number, not tiers, so this is a single flat-fee highlight
 * instead of a pricing grid. */
export function FeesSection() {
  return (
    <section id="fees" className="relative py-24 lg:py-32 border-t border-border">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="max-w-2xl mb-16">
          <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-4">
            <span className="w-8 h-px bg-foreground/30" />
            Fees
          </span>
          <h2 className="text-4xl lg:text-6xl font-display tracking-tight text-balance">One flat rate. No surprises.</h2>
        </div>

        <div className="border border-foreground rounded-lg px-8 lg:px-16 py-16 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
          <div>
            <span className="text-7xl lg:text-8xl font-display leading-none">1%</span>
            <p className="text-muted-foreground mt-4 max-w-sm">
              Charged on every buy and sell, same rate for every market. Each window is seeded by the protocol, so
              you never have to fund or manage liquidity yourself.
            </p>
          </div>
          <p className="text-sm font-mono text-muted-foreground max-w-xs lg:text-right">
            No account tiers, no volume discounts, no hidden spreads. What you see is what it costs.
          </p>
        </div>
      </div>
    </section>
  );
}
