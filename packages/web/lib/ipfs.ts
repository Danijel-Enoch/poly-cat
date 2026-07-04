/** Builds a public URL for an image CID from the configured IPFS gateway
 * (Pinata by default — see .env.example). Returns null if no gateway is
 * configured, or no CID was given — image is always optional (see
 * lib/category.ts). */
export function ipfsImageUrl(cid: string | null | undefined): string | null {
  const gateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY_URL;
  if (!gateway || !cid) return null;
  return `${gateway.replace(/\/$/, "")}/ipfs/${cid}`;
}
