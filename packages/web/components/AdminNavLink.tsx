"use client";

import Link from "next/link";
import { useAccount, useReadContract } from "wagmi";

import { marketFactoryContract } from "@/lib/contracts";

export function AdminNavLink() {
  const { address } = useAccount();
  const { data: owner } = useReadContract({ ...marketFactoryContract, functionName: "owner" });
  const isAdmin = !!address && !!owner && address.toLowerCase() === owner.toLowerCase();

  if (!isAdmin) return null;

  return (
    <Link href="/admin" className="shrink-0 text-sm font-medium text-gray-300 hover:text-white">
      Admin
    </Link>
  );
}
