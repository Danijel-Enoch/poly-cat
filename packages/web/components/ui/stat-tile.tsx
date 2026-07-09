import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/cn";

/** Label + big display-font value on a plain Card — the dashboard's stat
 * shape. Optimus has no literal equivalent (it's a landing-page kit), so
 * this is modeled on the hero's own eyebrow (mono, muted) + big number
 * (font-display) pairing, just packaged as a bordered tile instead of a
 * marquee entry. */
export function StatTile({
  label,
  value,
  description,
  valueClassName,
  className,
}: {
  label: string;
  value: React.ReactNode;
  description?: string;
  valueClassName?: string;
  className?: string;
}) {
  return (
    <Card className={cn("py-4 gap-1.5", className)}>
      <CardContent className="px-4">
        <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={cn("font-display text-3xl leading-none mt-1.5", valueClassName)}>{value}</p>
        {description && <p className="text-xs text-muted-foreground mt-1.5">{description}</p>}
      </CardContent>
    </Card>
  );
}
