import { cn } from "@/lib/cn";

/** Mono eyebrow label + font-display title — the dashboard's page-title
 * convention, modeled directly on the landing hero's own eyebrow-then-
 * headline pattern (see components/landing/hero-section.tsx), since
 * Optimus has no literal "app page header" to port. */
export function PageHeader({
  eyebrow,
  title,
  description,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("border-b border-border pb-6", className)}>
      {eyebrow && (
        <span className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wide text-muted-foreground mb-2">
          <span className="w-6 h-px bg-foreground/30" />
          {eyebrow}
        </span>
      )}
      <h1 className="text-4xl font-display tracking-tight text-foreground text-balance">{title}</h1>
      {description && <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{description}</p>}
    </div>
  );
}
