const points = [
  {
    title: "Non-custodial",
    description: "Funds only ever move on a transaction you sign. Nothing sits with a third party in between.",
  },
  {
    title: "Native ETH only",
    description: "No wrapped collateral token, no approval step to trust — you're trading the same ETH you hold.",
  },
  {
    title: "Onchain and verifiable",
    description: "Every market, trade, and settlement is a public transaction — check the contract yourself.",
  },
];

export function SecuritySection() {
  return (
    <section id="security" className="relative py-24 lg:py-32 border-t border-border bg-secondary/40">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="max-w-2xl mb-16">
          <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-4">
            <span className="w-8 h-px bg-foreground/30" />
            Security
          </span>
          <h2 className="text-4xl lg:text-6xl font-display tracking-tight text-balance">Your keys, your trade.</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-10">
          {points.map((point) => (
            <div key={point.title}>
              <h3 className="text-xl font-display mb-2">{point.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{point.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
