// Shared between the client-side picker (create/page.tsx) and the
// /api/upload-image route handler so both enforce the same limits.
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
