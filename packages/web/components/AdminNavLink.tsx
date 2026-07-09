"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount, useReadContract } from "wagmi";

import { marketFactoryContract } from "@/lib/contracts";

/** Owner-only Admin nav item. Renders nothing unless the connected wallet is
 * the contract's current `owner()`. Styled to match DashboardNav's other
 * links so it slots in seamlessly. */
export function AdminNavLink({ pathname }: { pathname?: string }) {
  const { address } = useAccount();
  // Gated on a connected wallet — mounted globally in the dashboard nav (see
  // components/DashboardNav.tsx), so an unconditional read here would fire
  // an owner() RPC call on every page for every visitor, including the vast
  // majority who never connect a wallet at all.
  const { data: owner } = useReadContract({
    ...marketFactoryContract,
    functionName: "owner",
    query: { enabled: !!address },
  });
  const ownPathname = usePathname();
  const isAdmin = !!address && !!owner && address.toLowerCase() === owner.toLowerCase();

  if (!isAdmin) return null;

  const current = pathname ?? ownPathname;
  const active = current === "/admin" || current.startsWith("/admin/");

  return (
    <Link
      href="/admin"
      className={`relative text-sm shrink-0 transition-colors group ${active ? "text-foreground" : "text-foreground/60 hover:text-foreground"}`}
    >
      Admin
      <span className={`absolute -bottom-1 left-0 h-px bg-foreground transition-all duration-300 ${active ? "w-full" : "w-0 group-hover:w-full"}`} />
    </Link>
  );
}
