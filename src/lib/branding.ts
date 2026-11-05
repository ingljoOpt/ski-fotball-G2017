import { z } from "zod";

export const DEFAULT_PRIMARY = "#176345";
export const DEFAULT_ACCENT = "#e7d995";
export const MAX_LOGO_BYTES = 512 * 1024;
export const MAX_LOGO_DIMENSION = 2048;
export const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Bruk en farge med seks heksadesimale tegn, for eksempel #176345.")
  .transform((value) => value.toLowerCase());

function luminance(color: string) {
  const channels = [1, 3, 5].map((offset) => {
    const channel = parseInt(color.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function contrastRatio(first: string, second: string) {
  const a = luminance(hexColor.parse(first));
  const b = luminance(hexColor.parse(second));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function foregroundFor(color: string) {
  return contrastRatio(color, "#000000") >= contrastRatio(color, "#ffffff") ? "#000000" : "#ffffff";
}

export const brandingSchema = z.object({
  primaryColor: hexColor.refine((value) => ["#ffffff", "#f7f8f2"].every((surface) => contrastRatio(value, surface) >= 4.5),
    "Primærfargen må ha minst 4,5:1 kontrast mot hvitt og sidens lyse bakgrunn. Velg en mørkere farge."),
  accentColor: hexColor,
});

export type ClubBranding = {
  name: string;
  primaryColor: string;
  accentColor: string;
  logoData: string | null;
};
