import { NextResponse } from "next/server";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/imageUpload";

const PINATA_PIN_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";

// Proxies to Pinata instead of letting the browser call it directly, so the
// PINATA_JWT secret never reaches the client.
export async function POST(request: Request) {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    return NextResponse.json({ error: "Image upload is not configured." }, { status: 501 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Unsupported image type." }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image is too large (max 5MB)." }, { status: 400 });
  }

  const upstreamForm = new FormData();
  upstreamForm.append("file", file, file.name);

  const upstreamResponse = await fetch(PINATA_PIN_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body: upstreamForm,
  });
  if (!upstreamResponse.ok) {
    return NextResponse.json({ error: "Upload to Pinata failed." }, { status: 502 });
  }

  const { IpfsHash: cid } = (await upstreamResponse.json()) as { IpfsHash: string };
  return NextResponse.json({ cid });
}
