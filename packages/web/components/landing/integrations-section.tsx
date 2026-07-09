const sources = [
  { name: "Gate.com", role: "Blue-chip assets — BTC, ETH, SOL and more" },
  { name: "DexScreener", role: "Onchain pairs — Robinhood Chain memecoins" },
];

/** Repurposed from the reference's third-party-logo "Integrations" section
 * — Polycat's equivalent is its two price sources. */
export function IntegrationsSection() {
  return (
    <section id="integrations" className="relative py-24 lg:py-32 border-t border-border">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="max-w-2xl mb-16">
          <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-4">
            <span className="w-8 h-px bg-foreground/30" />
            Price sources
          </span>
          <h2 className="text-4xl lg:text-6xl font-display tracking-tight text-balance">Priced off the real market.</h2>
        </div>

        <div className="grid sm:grid-cols-2 gap-px bg-border border border-border">
          {sources.map((source) => (
            <div key={source.name} className="bg-background p-10 hover-lift">
              <p className="text-3xl font-display mb-2">{source.name}</p>
              <p className="text-sm text-muted-foreground">{source.role}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
