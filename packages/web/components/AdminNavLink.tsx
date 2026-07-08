"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount, useReadContract } from "wagmi";

import { marketFactoryContract } from "@/lib/contracts";

function IconShield() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 4 6v5c0 4.5 3.2 7.8 8 9 4.8-1.2 8-4.5 8-9V6Z" />
    </svg>
  );
}

/** Owner-only Admin nav item. Renders nothing unless the connected wallet is
 * the contract's current `owner()`. Styled to match the sidebar's other links
 * (active state + icon) so it slots into the same list seamlessly. */
export function AdminNavLink({
  pathname,
  onNavigate,
}: {
  pathname?: string;
  onNavigate?: () => void;
}) {
  const { address } = useAccount();
  const { data: owner } = useReadContract({ ...marketFactoryContract, functionName: "owner" });
  const ownPathname = usePathname();
  const isAdmin = !!address && !!owner && address.toLowerCase() === owner.toLowerCase();

  if (!isAdmin) return null;

  const current = pathname ?? ownPathname;
  const active = current === "/admin" || current.startsWith("/admin/");

  return (
    <Link
      href="/admin"
      onClick={onNavigate}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active ? "bg-gray-800 text-white" : "text-gray-300 hover:bg-gray-800 hover:text-white"
      }`}
    >
      <IconShield />
      Admin
    </Link>
  );
}
