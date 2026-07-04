export function VerifiedBadge({ size = 14 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      className="text-accent shrink-0"
      role="img"
      aria-label="Verified by HoodMarkets"
    >
      <title>Verified by HoodMarkets</title>
      <path d="M12 2 14.4 4.4 17.7 3.9 18.6 7.2 21.6 8.9 20.3 12 21.6 15.1 18.6 16.8 17.7 20.1 14.4 19.6 12 22 9.6 19.6 6.3 20.1 5.4 16.8 2.4 15.1 3.7 12 2.4 8.9 5.4 7.2 6.3 3.9 9.6 4.4Z" />
      <path d="M9.5 12.2 11.2 14 14.8 10" stroke="#0a0f0a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
