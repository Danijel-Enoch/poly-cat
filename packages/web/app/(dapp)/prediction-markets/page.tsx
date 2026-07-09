import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export default function PredictionMarketsPage() {
  return (
    <div className="flex flex-col gap-10">
      <PageHeader eyebrow="Coming soon" title="Prediction Market" description="This section is still being built." />

      <Card className="max-w-lg">
        <CardContent className="flex flex-col items-start gap-4">
          <p className="text-sm text-muted-foreground">
            We&apos;re working on it — check back soon. In the meantime, every 5-minute Up/Down window is already
            live on the Markets tab.
          </p>
          <Link href="/app" className={cn(buttonVariants({ size: "sm" }), "rounded-full")}>
            Browse live markets
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
