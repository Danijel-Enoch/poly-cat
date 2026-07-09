const steps = [
  {
    number: "01",
    title: "Connect a wallet",
    description: "No signup, no email — connect and you're ready to trade.",
  },
  {
    number: "02",
    title: "Pick an asset and a side",
    description: "Each market shows the strike price and the live implied chance of Up for its five-minute window.",
  },
  {
    number: "03",
    title: "Trade with ETH",
    description: "One transaction — spend an exact amount, or target an exact share count.",
  },
  {
    number: "04",
    title: "Exit or redeem",
    description: "Sell out before the window closes, or hold and redeem once it settles.",
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="relative py-24 lg:py-32 border-t border-border">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="mb-16 max-w-2xl">
          <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-4">
            <span className="w-8 h-px bg-foreground/30" />
            Getting started
          </span>
          <h2 className="text-4xl lg:text-6xl font-display tracking-tight text-balance">Four steps, start to finish.</h2>
        </div>

        <div className="grid md:grid-cols-4 gap-8">
          {steps.map((step) => (
            <div key={step.number} className="hover-lift">
              <span className="font-mono text-sm text-muted-foreground">{step.number}</span>
              <h3 className="text-xl font-display mt-3 mb-2">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
