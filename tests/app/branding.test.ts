import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { ZodError } from "zod";
import {
  brandingSchema, contrastRatio, DEFAULT_ACCENT, DEFAULT_PRIMARY, foregroundFor, MAX_LOGO_BYTES, PAGE_BACKGROUND,
} from "../../src/lib/branding.ts";
import { logoFromForm, normalizeLogo } from "../../src/lib/logo.ts";

test("club colors validate exact format and WCAG contrast threshold", () => {
  assert.equal(contrastRatio("#000000", "#ffffff"), 21);
  assert.equal(contrastRatio("#ffffff", "#ffffff"), 1);
  assert.ok(contrastRatio(DEFAULT_PRIMARY, "#ffffff") >= 4.5);
  assert.equal(DEFAULT_PRIMARY, "#0e4286");
  assert.equal(DEFAULT_ACCENT, "#ecf0ea");
  assert.ok(contrastRatio(DEFAULT_PRIMARY, PAGE_BACKGROUND) >= 4.5);
  assert.deepEqual(brandingSchema.parse({ primaryColor: "#176345", accentColor: "#AABBCC" }), {
    primaryColor: "#176345", accentColor: "#aabbcc",
  });
  assert.equal(brandingSchema.safeParse({ primaryColor: "#717171", accentColor: DEFAULT_ACCENT }).success, true);
  assert.ok(contrastRatio("#767676", "#ffffff") >= 4.5);
  assert.ok(contrastRatio("#767676", "#f7f8f2") < 4.5);
  assert.ok(contrastRatio("#767676", PAGE_BACKGROUND) < 4.5);
  for (const primaryColor of ["#767676", "#777777", "#ffffff", "#fff", "red", "url(evil)", "#000000; color: red"]) {
    assert.equal(brandingSchema.safeParse({ primaryColor, accentColor: DEFAULT_ACCENT }).success, false);
  }
  assert.equal(brandingSchema.safeParse({ primaryColor: DEFAULT_PRIMARY, accentColor: "#ff000080" }).success, false);
});

test("empty native and Next file placeholders preserve logos, but named empty uploads are validated", () => {
  assert.equal(logoFromForm(null), null);
  for (const name of ["", "undefined"]) {
    assert.equal(logoFromForm(new File([], name, { type: "application/octet-stream" })), null);
  }
  const emptyPng = new File([], "empty.png", { type: "image/png" });
  assert.equal(logoFromForm(emptyPng), emptyPng);
  assert.throws(() => logoFromForm("https://external.example/logo.png"), ZodError);
});
test("accent foreground always reaches 4.5:1 for light, dark and midtone colors", () => {
  for (const color of ["#ffffff", "#000000", "#767676", "#777777", "#ff0000", "#00ff00", "#0000ff", DEFAULT_ACCENT]) {
    assert.ok(contrastRatio(color, foregroundFor(color)) >= 4.5, color);
  }
});

test("logos are decoded, scaled and stored as metadata-free WebP", async () => {
  for (const format of ["png", "jpeg", "webp"] as const) {
    const input = await sharp({ create: { width: 1024, height: 256, channels: 3, background: "#123456" } })
      .withMetadata().toFormat(format).toBuffer();
    const result = await normalizeLogo(new File([new Uint8Array(input)], `logo.${format}`, {
      type: `image/${format === "jpeg" ? "jpeg" : format}`,
    }));
    assert.ok(result.startsWith("data:image/webp;base64,"));
    const metadata = await sharp(Buffer.from(result.split(",")[1], "base64")).metadata();
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, 512);
    assert.equal(metadata.height, 128);
    assert.equal(metadata.exif, undefined);
    assert.equal(metadata.icc, undefined);
  }
});

test("logos reject excessive size, dimensions, animation, spoofing and corrupt data", async () => {
  const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#123456" } }).png().toBuffer();
  const wide = await sharp({ create: { width: 2049, height: 1, channels: 3, background: "#123456" } }).png().toBuffer();
  const animatedWebp = await sharp(Buffer.from([255, 0, 0, 0, 0, 255]), {
    raw: { width: 1, height: 2, channels: 3, pageHeight: 1 },
  }).webp({ loop: 0, delay: [100, 100] }).toBuffer();
  assert.equal((await sharp(animatedWebp).metadata()).pages, 2);
  for (const file of [
    new File([], "empty.png", { type: "image/png" }),
    new File([new Uint8Array(MAX_LOGO_BYTES + 1)], "huge.png", { type: "image/png" }),
    new File([new Uint8Array(wide)], "wide.png", { type: "image/png" }),
    new File([new Uint8Array(png)], "wrong.jpg", { type: "image/jpeg" }),
    new File(["<svg xmlns='http://www.w3.org/2000/svg'/>"], "logo.svg", { type: "image/svg+xml" }),
    new File(["<svg xmlns='http://www.w3.org/2000/svg'/>"], "spoof.png", { type: "image/png" }),
    new File(["not an image"], "corrupt.png", { type: "image/png" }),
    new File([new Uint8Array(animatedWebp)], "animated.webp", { type: "image/webp" }),
  ]) await assert.rejects(normalizeLogo(file), ZodError, file.name);
});

test("logo limits accept exactly 512 KiB and 2048 pixels", async () => {
  const png = await sharp({ create: { width: 2048, height: 1, channels: 3, background: "#123456" } }).png().toBuffer();
  const padded = Buffer.alloc(MAX_LOGO_BYTES);
  png.copy(padded);
  const result = await normalizeLogo(new File([new Uint8Array(padded)], "boundary.png", { type: "image/png" }));
  assert.ok(result.startsWith("data:image/webp;base64,"));
});
