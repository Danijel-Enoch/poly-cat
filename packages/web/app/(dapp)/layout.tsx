import Link from "next/link";
import { ConnectButton } from "@/components/ConnectButton";
import { AdminNavLink } from "@/components/AdminNavLink";
import { MobileNavMenu } from "@/components/MobileNavMenu";
import { Logo } from "@/components/Logo";

export default function DappLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-10 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-3">
          <div className="relative rounded-2xl border border-gray-800 bg-[#030200] backdrop-blur-md px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 sm:gap-6 min-w-0">
              <Link href="/app" className="flex items-center gap-2 shrink-0">
                <Logo size={36} className="h-9 w-auto" />
                <span className="font-semibold tracking-tight text-lg hidden sm:inline">Polycat</span>
              </Link>
              <nav className="hidden sm:flex items-center gap-4 sm:gap-6">
                <Link href="/app" className="shrink-0 text-sm font-medium text-gray-300 hover:text-white">
                  Markets
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
              <ConnectButton />
              <MobileNavMenu />
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">{children}</main>
    </>
  );
}
