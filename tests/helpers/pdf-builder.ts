/**
 * Minimal synthetic PDF writer for tests.
 *
 * We hand-assemble the smallest valid PDF that pdf.js can parse: one Catalog,
 * one Pages tree, one shared Type1/Helvetica font, and N pages whose content
 * streams place text at explicit (x, y) coordinates via the `Tm` operator.
 * Because we choose those coordinates, tests can assert exact bounding boxes
 * instead of guessing at layout — and we avoid committing opaque binary
 * fixture files that are painful to review or regenerate.
 */

export type PdfTextItem = {
  text: string;
  x: number;
  y: number;
  size?: number;
};

export type PdfPageSpec = {
  items: PdfTextItem[];
  width?: number;
  height?: number;
};

function escapePdfString(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildContentStream(items: PdfTextItem[]): string {
  return items
    .map((item) => {
      const size = item.size ?? 12;
      const escaped = escapePdfString(item.text);
      return `BT /F1 ${size} Tf 1 0 0 1 ${item.x} ${item.y} Tm (${escaped}) Tj ET`;
    })
    .join("\n");
}

/** Builds a minimal well-formed PDF (as raw bytes) with the given pages. */
export function buildPdf(pages: PdfPageSpec[]): Uint8Array {
  const fontObjId = 3;
  const firstPageObjId = 4;

  const objects: string[] = [];
  objects[1] = `<< /Type /Catalog /Pages 2 0 R >>`;

  const pageObjIds = pages.map((_, i) => firstPageObjId + i * 2);
  const contentObjIds = pages.map((_, i) => firstPageObjId + i * 2 + 1);

  objects[2] = `<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[fontObjId] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`;

  pages.forEach((page, i) => {
    const width = page.width ?? 612;
    const height = page.height ?? 792;
    const pageObjId = pageObjIds[i];
    const contentObjId = contentObjIds[i];

    objects[pageObjId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] ` +
      `/Resources << /Font << /F1 ${fontObjId} 0 R >> >> /Contents ${contentObjId} 0 R >>`;

    const stream = buildContentStream(page.items);
    objects[contentObjId] = `STREAM:${stream}`;
  });

  const totalObjects = objects.length; // sparse array; length = highest index + 1
  let body = "%PDF-1.4\n";
  const offsets: number[] = new Array(totalObjects).fill(0);

  for (let id = 1; id < totalObjects; id++) {
    const raw = objects[id];
    if (raw === undefined) continue;

    offsets[id] = body.length;

    if (raw.startsWith("STREAM:")) {
      const stream = raw.slice("STREAM:".length);
      const streamBytes = new TextEncoder().encode(stream).length;
      body += `${id} 0 obj\n<< /Length ${streamBytes} >>\nstream\n${stream}\nendstream\nendobj\n`;
    } else {
      body += `${id} 0 obj\n${raw}\nendobj\n`;
    }
  }

  const xrefOffset = body.length;
  let xref = `xref\n0 ${totalObjects}\n0000000000 65535 f \n`;
  for (let id = 1; id < totalObjects; id++) {
    const offset = offsets[id] ?? 0;
    xref += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }

  const trailer =
    `trailer\n<< /Size ${totalObjects} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const pdfString = body + xref + trailer;
  return new TextEncoder().encode(pdfString);
}
