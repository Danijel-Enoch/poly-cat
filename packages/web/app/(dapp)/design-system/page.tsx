import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { cn } from "@/lib/cn";

// Live reference for every token and primitive this app is actually built
// on — not a separate spec, a rendering of app/globals.css and
// components/ui/* as they exist right now. Swatches use the same
// bg-<token> Tailwind utilities the rest of the app uses, so this page
// tracks light/dark mode and any future token edit automatically; only the
// oklch/hex reference values below are hand-copied from globals.css and
// need updating if that file changes.

type ColorToken = {
  name: string;
  varName: string;
  className: string;
  light: string;
  dark: string;
  note?: string;
};

const CORE_TOKENS: ColorToken[] = [
  { name: "Background", varName: "--background", className: "bg-background border border-border", light: "oklch(0.985 0.002 90)", dark: "oklch(0.16 0.008 60)" },
  { name: "Foreground", varName: "--foreground", className: "bg-foreground", light: "oklch(0.12 0.01 60)", dark: "oklch(0.94 0.004 90)" },
  { name: "Card", varName: "--card", className: "bg-card border border-border", light: "oklch(1 0 0)", dark: "oklch(0.2 0.008 60)" },
  { name: "Primary", varName: "--primary", className: "bg-primary", light: "oklch(0.12 0.01 60)", dark: "oklch(0.94 0.004 90)" },
  { name: "Secondary", varName: "--secondary", className: "bg-secondary", light: "oklch(0.96 0.005 90)", dark: "oklch(0.26 0.008 60)" },
  { name: "Muted", varName: "--muted", className: "bg-muted", light: "oklch(0.94 0.005 90)", dark: "oklch(0.24 0.008 60)" },
  { name: "Accent", varName: "--accent", className: "bg-accent", light: "oklch(0.92 0.01 90)", dark: "oklch(0.29 0.01 60)" },
  { name: "Destructive", varName: "--destructive", className: "bg-destructive", light: "oklch(0.577 0.245 27.325)", dark: "oklch(0.65 0.2 25)" },
  { name: "Border", varName: "--border", className: "bg-border", light: "oklch(0.88 0.01 90)", dark: "oklch(0.3 0.01 60)" },
  { name: "Input", varName: "--input", className: "bg-input", light: "oklch(0.92 0.01 90)", dark: "oklch(0.29 0.01 60)" },
  { name: "Ring", varName: "--ring", className: "bg-ring", light: "oklch(0.12 0.01 60)", dark: "oklch(0.7 0.01 60)" },
];

const SEMANTIC_TOKENS: ColorToken[] = [
  { name: "Up", varName: "--up", className: "bg-up", light: "#3f7a52", dark: "#5fae79", note: "Odds, buy-side, PnL gain" },
  { name: "Down", varName: "--down", className: "bg-down", light: "#b54b3a", dark: "#d17a63", note: "Odds, sell-side, PnL loss" },
];

const RADII = [
  { name: "sm", token: "--radius-sm", value: "calc(var(--radius) - 4px)", className: "rounded-sm" },
  { name: "md", token: "--radius-md", value: "calc(var(--radius) - 2px)", className: "rounded-md" },
  { name: "lg", token: "--radius-lg", value: "var(--radius) = 0.25rem", className: "rounded-lg" },
  { name: "xl", token: "--radius-xl", value: "calc(var(--radius) + 4px)", className: "rounded-xl" },
  { name: "full", token: "—", value: "9999px", className: "rounded-full" },
];

function Section({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5">
      <div>
        <span className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wide text-muted-foreground mb-2">
          <span className="w-6 h-px bg-foreground/30" />
          {eyebrow}
        </span>
        <h2 className="text-2xl font-display tracking-tight">{title}</h2>
        {description && <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function ColorCard({ token }: { token: ColorToken }) {
  return (
    <div className="flex flex-col gap-2">
      <div className={cn("h-16 rounded-md", token.className)} />
      <div>
        <p className="text-sm font-medium">{token.name}</p>
        <p className="text-xs font-mono text-muted-foreground">{token.varName}</p>
        <p className="text-[11px] text-muted-foreground mt-1">
          light <span className="font-mono">{token.light}</span>
        </p>
        <p className="text-[11px] text-muted-foreground">
          dark <span className="font-mono">{token.dark}</span>
        </p>
        {token.note && <p className="text-[11px] text-muted-foreground mt-1">{token.note}</p>}
      </div>
    </div>
  );
}

const SAMPLE_ROWS = [
  { asset: "Bitcoin", side: "Buy", eth: "0.0500", shares: "0.0489" },
  { asset: "Ethereum", side: "Sell", eth: "0.0120", shares: "0.0117" },
];

export default function DesignSystemPage() {
  return (
    <div className="flex flex-col gap-16">
      <PageHeader
        eyebrow="Internal reference"
        title="Design System"
        description="Every token and primitive packages/web is actually built on — a live rendering of app/globals.css and components/ui/*, not a separate spec. Toggle light/dark to see the swatches update."
      />

      <Section
        eyebrow="Foundation"
        title="Color"
        description="A near-monochrome, warm-neutral palette ported from the Optimus reference, plus one deliberate departure: a muted Up/Down pair, since a prediction market needs an at-a-glance odds read that pure monochrome can't give it."
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
          {CORE_TOKENS.map((t) => (
            <ColorCard key={t.varName} token={t} />
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5 pt-2 border-t border-border">
          {SEMANTIC_TOKENS.map((t) => (
            <ColorCard key={t.varName} token={t} />
          ))}
        </div>
      </Section>

      <Section
        eyebrow="Foundation"
        title="Typography"
        description="Three faces, each with one job: Instrument Serif for display type, Instrument Sans for everything readable, JetBrains Mono for labels and data."
      >
        <div className="flex flex-col gap-6">
          <Card>
            <CardContent className="flex flex-col gap-1">
              <p className="text-xs font-mono uppercase tracking-wide text-muted-foreground">font-display · Instrument Serif</p>
              <p className="font-display text-5xl tracking-tight">The market to settle</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col gap-1">
              <p className="text-xs font-mono uppercase tracking-wide text-muted-foreground">font-sans · Instrument Sans (default)</p>
              <p className="text-lg">Pick a token, pick a side. Every market runs exactly five minutes.</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col gap-1">
              <p className="text-xs font-mono uppercase tracking-wide text-muted-foreground">font-mono · JetBrains Mono</p>
              <p className="font-mono text-sm">Strike $62,193.70 · Closes 12:35:00 AM</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
          {[
            { cls: "text-4xl font-display", label: "text-4xl font-display — page title" },
            { cls: "text-2xl font-display", label: "text-2xl font-display — section title" },
            { cls: "text-3xl font-display", label: "text-3xl font-display — stat value" },
            { cls: "text-lg", label: "text-lg — card heading" },
            { cls: "text-sm", label: "text-sm — body" },
            { cls: "text-xs font-mono uppercase tracking-wide text-muted-foreground", label: "text-xs font-mono uppercase — eyebrow/label" },
          ].map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-4 border-b border-border pb-2">
              <span className={row.cls}>Aa 123</span>
              <span className="text-[11px] font-mono text-muted-foreground shrink-0">{row.label}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section eyebrow="Foundation" title="Radius" description="One base --radius (0.25rem), a derived sm/md/lg/xl scale, and rounded-full for pills and interactive chips.">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-5">
          {RADII.map((r) => (
            <div key={r.name} className="flex flex-col gap-2">
              <div className={cn("h-16 bg-secondary border border-border", r.className)} />
              <div>
                <p className="text-sm font-medium">{r.name}</p>
                <p className="text-[11px] font-mono text-muted-foreground">{r.value}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section eyebrow="Primitive" title="Button" description="components/ui/button.tsx — six variants, five sizes, plus an up/down pair reserved for the one place semantic color belongs on a button (the buy/sell side toggle).">
        <div className="flex flex-col gap-4">
          {(["default", "secondary", "outline", "ghost", "destructive", "link", "up", "down"] as const).map((variant) => (
            <div key={variant} className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-mono text-muted-foreground w-20 shrink-0">{variant}</span>
              <Button variant={variant}>Button</Button>
              <Button variant={variant} size="sm">
                Small
              </Button>
              <Button variant={variant} size="lg">
                Large
              </Button>
              <Button variant={variant} disabled>
                Disabled
              </Button>
            </div>
          ))}
        </div>
      </Section>

      <Section eyebrow="Primitive" title="Badge" description="components/ui/badge.tsx — status chips and the same up/down semantic pair, used for market state and trade side.">
        <div className="flex flex-wrap gap-3">
          {(["default", "secondary", "outline", "destructive", "up", "down"] as const).map((variant) => (
            <Badge key={variant} variant={variant}>
              {variant}
            </Badge>
          ))}
        </div>
      </Section>

      <Section eyebrow="Primitive" title="Card &amp; Stat Tile" description="Plain bordered surfaces — no nested-frame or gradient-border treatment. Every dashboard card in the app is one of these two shapes.">
        <div className="grid sm:grid-cols-3 gap-5">
          <StatTile label="Volume traded" value="128.4 ETH" description="All-time, all markets" />
          <StatTile label="Chance up" value="64%" valueClassName="text-[var(--up)]" />
          <StatTile label="Chance down" value="36%" valueClassName="text-[var(--down)]" />
        </div>
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Plain <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">Card</code> +{" "}
              <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">CardContent</code> — rounded-xl,
              1px border, shadow-sm. Every panel in the app (trade panel, market info, admin tables) is this
              same surface.
            </p>
          </CardContent>
        </Card>
      </Section>

      <Section eyebrow="Primitive" title="Table" description="Real <table> at md: and up; ResponsiveTable (components/ui/responsive-table.tsx) stacks the same column config into labeled cards below md: so data never scrolls horizontally on a phone.">
        <Card className="py-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead>Side</TableHead>
                <TableHead>ETH</TableHead>
                <TableHead>Shares</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SAMPLE_ROWS.map((row) => (
                <TableRow key={row.asset}>
                  <TableCell className="font-medium">{row.asset}</TableCell>
                  <TableCell>
                    <span style={{ color: row.side === "Buy" ? "var(--up)" : "var(--down)" }}>{row.side}</span>
                  </TableCell>
                  <TableCell>{row.eth}</TableCell>
                  <TableCell>{row.shares}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </Section>

      <Section eyebrow="Motion" title="Utilities" description="Motion utilities live in app/globals.css. Dashboard screens spend their motion budget on data (chart line draw-in, hover tilt) and stay otherwise restrained; the landing page uses the fuller set.">
        <div className="grid sm:grid-cols-2 gap-5">
          <Card className="hover-lift cursor-default">
            <CardContent>
              <p className="text-sm font-medium">.hover-lift</p>
              <p className="text-xs text-muted-foreground mt-1">Hover this card — springs up 4px.</p>
            </CardContent>
          </Card>
          <Card className="overflow-hidden py-0">
            <CardContent className="px-0 py-6">
              <p className="text-sm font-medium px-6 mb-3">.marquee</p>
              <div className="flex gap-8 marquee whitespace-nowrap">
                {[0, 1].map((i) => (
                  <div key={i} className="flex gap-8 text-sm text-muted-foreground shrink-0 pl-6">
                    <span>5 min window length</span>
                    <span>1% flat trading fee</span>
                    <span>Native ETH</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section eyebrow="Convention" title="Icons" description="No icon library — every icon in this app (menu, close, sun/moon, search, arrows) is a small hand-rolled inline SVG living next to the component that uses it, matching the reference kit's own convention rather than adding lucide-react or a similar dependency.">
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              See <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">components/DashboardNav.tsx</code>,{" "}
              <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">components/ThemeToggle.tsx</code>, and{" "}
              <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">components/landing/navigation.tsx</code> for
              examples of the pattern.
            </p>
          </CardContent>
        </Card>
      </Section>
    </div>
  );
}
