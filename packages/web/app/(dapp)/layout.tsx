import Image from "next/image";
import Link from "next/link";
import { ConnectButton } from "@/components/ConnectButton";
import { AdminNavLink } from "@/components/AdminNavLink";
import { MobileNavMenu } from "@/components/MobileNavMenu";

export default function DappLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-10 bg-gray-900 border-b border-gray-800">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 sm:gap-6 min-w-0">
            <Link href="/app" className="flex items-center gap-2 shrink-0">
              <Image src="/Icon.png" alt="HoodMarkets" width={28} height={28} className="h-7 w-7 rounded-full" priority />
              <span className="font-extrabold tracking-tight text-lg hidden sm:inline">HoodMarkets</span>
            </Link>
            <nav className="hidden sm:flex items-center gap-4 sm:gap-6">
              <Link href="/app" className="shrink-0 text-sm font-medium text-gray-300 hover:text-white">
                Markets
              </Link>
              <Link href="/leaderboard" className="shrink-0 text-sm font-medium text-gray-300 hover:text-white">
                Leaderboard
              </Link>
              <Link href="/portfolio" className="shrink-0 text-sm font-medium text-gray-300 hover:text-white">
                Portfolio
              </Link>
              <Link href="/docs" className="shrink-0 text-sm font-medium text-gray-300 hover:text-white">
                Docs
              </Link>
              <AdminNavLink />
            </nav>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link
              href="/create"
              aria-label="Create Market"
              className="flex items-center justify-center h-9 w-9 sm:h-auto sm:w-auto sm:px-4 sm:py-2 text-sm font-semibold rounded-full bg-accent text-gray-900 hover:bg-accent-dark transition-colors"
            >
              <span className="sm:hidden text-lg leading-none">+</span>
              <span className="hidden sm:inline">Create Market</span>
            </Link>
            <ConnectButton />
            <MobileNavMenu />
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">{children}</main>
    </>
  );
}
