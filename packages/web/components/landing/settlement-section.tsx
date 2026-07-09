const rules = [
  { label: "Below strike", outcome: "Down wins" },
  { label: "Above strike", outcome: "Up wins" },
  { label: "Exact match", outcome: "Push — pro-rata refund" },
];

/** Repurposed from the reference's "Developers" section — Polycat has no
 * API/SDK, so this covers the equivalent trust question for a prediction
 * market: how settlement actually gets decided. */
export function SettlementSection() {
  return (
    <section className="relative py-24 lg:py-32 border-t border-border bg-secondary/40">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12 grid lg:grid-cols-2 gap-16 items-center">
        <div>
          <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-4">
            <span className="w-8 h-px bg-foreground/30" />
            How settlement works
          </span>
          <h2 className="text-4xl lg:text-5xl font-display tracking-tight text-balance mb-6">
            No admin judgment calls.
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed max-w-lg">
            A background process settles every window the moment it closes: it reads the asset&apos;s live price and
            submits it onchain. From there the outcome is decided mechanically — the same rule, applied the same
            way, every time.
          </p>
        </div>

        <div className="border border-border rounded-lg bg-background divide-y divide-border">
          {rules.map((rule) => (
            <div key={rule.label} className="flex items-center justify-between px-6 py-5">
              <span className="font-mono text-sm text-muted-foreground">{rule.label}</span>
              <span className="font-display text-lg">{rule.outcome}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
