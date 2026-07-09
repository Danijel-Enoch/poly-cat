const features = [
  {
    number: "01",
    title: "Always a counterparty",
    description:
      "Every market is its own automated market maker on a bonding curve — there's a price to trade at from the very first trade in a fresh window, no order book required.",
  },
  {
    number: "02",
    title: "Fixed 5-minute windows",
    description: "Every market runs exactly five minutes, aligned to the clock. The moment one settles, the next opens for that asset.",
  },
  {
    number: "03",
    title: "Curated, growing list",
    description: "Blue-chip assets priced via Gate.com, plus onchain pairs priced via DexScreener — added through the admin dashboard, not a code change.",
  },
  {
    number: "04",
    title: "Native ETH, one transaction",
    description: "No wrapped collateral token, no approval step. Trading is a single signed transaction using the same ETH you pay gas in.",
  },
  {
    number: "05",
    title: "Mechanical settlement",
    description: "The observed close price decides the outcome automatically, straight off a live feed — no admin judgment call, no dispute window.",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="relative py-24 lg:py-32 border-t border-border">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="mb-16 max-w-2xl">
          <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-4">
            <span className="w-8 h-px bg-foreground/30" />
            How markets work
          </span>
          <h2 className="text-4xl lg:text-6xl font-display tracking-tight text-balance">A market for every five minutes.</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-px bg-border border border-border">
          {features.map((feature) => (
            <div key={feature.number} className="bg-background p-8 lg:p-10 hover-lift">
              <span className="font-mono text-sm text-muted-foreground">{feature.number}</span>
              <h3 className="text-2xl font-display mt-4 mb-2">{feature.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
