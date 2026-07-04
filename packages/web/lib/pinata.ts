import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "./imageUpload";

const PINATA_PIN_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";

export async function pinFileToIPFS(file: File, jwt: string): Promise<string> {
  const form = new FormData();
  form.append("file", file, file.name);
  const res = await fetch(PINATA_PIN_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Upload to Pinata failed: ${res.status}`);
  }
  const { IpfsHash } = (await res.json()) as { IpfsHash: string };
  return IpfsHash;
}

/** Downloads a remote image (e.g. a Polymarket market's icon) and re-pins it
 * to our own Pinata account, so a HoodMarkets market never hotlinks a third
 * party's image — same gateway/CID scheme as user-uploaded market images
 * (see lib/category.ts's `[img:CID]` tag). Returns null instead of throwing
 * on any failure — a missing image should never block a market import. */
export async function pinImageFromUrl(imageUrl: string): Promise<string | null> {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) return null;

  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return null;

    const contentType = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    if (!ALLOWED_IMAGE_TYPES.has(contentType)) return null;

    const buffer = await res.arrayBuffer();
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_IMAGE_BYTES) return null;

    const filename = imageUrl.split("/").pop()?.split("?")[0] || "image";
    const file = new File([buffer], filename, { type: contentType });
    return await pinFileToIPFS(file, jwt);
  } catch {
    return null;
  }
}
