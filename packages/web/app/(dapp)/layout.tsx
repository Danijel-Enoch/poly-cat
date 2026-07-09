import { DashboardNav } from "@/components/DashboardNav";

// (dapp) routes get their own persistent multi-route nav — the landing page
// composes its own single-page anchor <Navigation/> directly instead (see
// app/page.tsx), since the two need genuinely different nav patterns.
export default function DappLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <DashboardNav />
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-10 flex-1">{children}</div>
    </div>
  );
}
