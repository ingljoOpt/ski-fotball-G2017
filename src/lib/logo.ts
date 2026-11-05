import sharp from "sharp";
import { z } from "zod";
import { LOGO_TYPES, MAX_LOGO_BYTES, MAX_LOGO_DIMENSION } from "./branding.ts";

function invalidLogo(message: string): never {
  throw new z.ZodError([{ code: "custom", path: ["logo"], message }]);
}

export function logoFromForm(value: FormDataEntryValue | null): File | null {
  if (value === null) return null;
  if (!(value instanceof File)) invalidLogo("Logoen må lastes opp som en bildefil.");
  // React/Next may serialize an empty file input with the filename "undefined".
  if (value.size === 0 && value.type === "application/octet-stream" && ["", "undefined"].includes(value.name)) return null;
  return value;
}

export async function normalizeLogo(file: File) {
  if (!file.size || file.size > MAX_LOGO_BYTES) invalidLogo("Logoen må være mellom 1 byte og 512 KiB.");
  if (!LOGO_TYPES.includes(file.type)) invalidLogo("Velg en PNG-, JPEG- eller WebP-logo. SVG og animerte bilder støttes ikke.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const image = sharp(bytes, { limitInputPixels: MAX_LOGO_DIMENSION ** 2, failOn: "warning" });
  // Decode and re-encode instead of trusting the filename, MIME type or embedded metadata.
  try {
    const metadata = await image.metadata();
    const formats: Record<string, string | undefined> = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" };
    const mime = formats[metadata.format];
    if (mime !== file.type || !metadata.width || !metadata.height ||
      metadata.width > MAX_LOGO_DIMENSION || metadata.height > MAX_LOGO_DIMENSION || (metadata.pages ?? 1) !== 1) {
      invalidLogo("Logoen må være en statisk PNG, JPEG eller WebP, maksimalt 2048 × 2048 piksler, med samsvarende filtype.");
    }
    const normalized = await image.rotate().resize(512, 512, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 }).toBuffer();
    if (normalized.length > MAX_LOGO_BYTES) invalidLogo("Den behandlede logoen er for stor. Velg et enklere bilde.");
    return `data:image/webp;base64,${normalized.toString("base64")}`;
  } catch (error) {
    if (error instanceof z.ZodError) throw error;
    if (error instanceof Error) {
      invalidLogo("Logoen kunne ikke leses som et gyldig bilde. Kontroller filen, størrelsen og pikselgrensene.");
    }
    throw error;
  }
}
