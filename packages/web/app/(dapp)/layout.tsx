// The global sidebar (app/layout.tsx) now provides all top-level chrome — logo,
// nav, connect button — for every route, so this layout is just the content
// width wrapper for the dapp pages.
export default function DappLayout({ children }: { children: React.ReactNode }) {
  return <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">{children}</div>;
}
