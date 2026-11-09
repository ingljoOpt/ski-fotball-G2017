import { test } from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { readClubDocument } from "../../src/lib/club-documents.ts";

function pdf(text: string) {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(body));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(body);
  body += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return body;
}

test("extracts Markdown, PDF and Word and rejects unsupported, malformed or empty files", async () => {
  assert.equal((await readClubDocument(new File(["# Fotball\nPasning"], "plan.md"))).extractedText, "# Fotball\nPasning");
  assert.equal((await readClubDocument(new File(["Retningslinjer"], "plan.markdown"))).extractedText, "Retningslinjer");
  assert.match((await readClubDocument(new File([pdf("BT /F1 12 Tf 10 100 Td (Pasning) Tj ET")], "plan.pdf"))).extractedText, /Pasning/);
  const zip = new JSZip();
  zip.file("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>');
  zip.file("word/document.xml", '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Spillglede</w:t></w:r></w:p></w:body></w:document>');
  const docx = await zip.generateAsync({ type: "uint8array" });
  assert.match((await readClubDocument(new File([new Uint8Array(docx)], "plan.docx"))).extractedText, /Spillglede/);
  zip.file("word/large.xml", new Uint8Array(10 * 1024 * 1024 + 1));
  const oversizedArchive = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  await assert.rejects(readClubDocument(new File([new Uint8Array(oversizedArchive)], "stor.docx")), /kunne ikke leses/);
  await assert.rejects(readClubDocument(new File(["tekst"], "plan.doc")), /bare Markdown/);
  await assert.rejects(readClubDocument(new File(["ikke pdf"], "plan.pdf")), /kunne ikke leses/);
  await assert.rejects(readClubDocument(new File([pdf("")], "skannet.pdf")), /ingen tekst/);
  await assert.rejects(readClubDocument(new File(["a".repeat(50_001)], "lang.md")), /50 000/);
  await assert.rejects(readClubDocument(new File([new Uint8Array(2 * 1024 * 1024 + 1)], "stor.md")), /2 MiB/);
  await assert.rejects(readClubDocument(new File(["a"], "../plan.md")), /filnavn/);
});
