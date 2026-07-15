// The legacy build avoids assuming DOMMatrix/OffscreenCanvas are globally
// present, which keeps it working under both jsdom (tests) and browsers.
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfjsWorker from "pdfjs-dist/legacy/build/pdf.worker.mjs?url";
import type { PDFPageProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PageViewport } from "pdfjs-dist/legacy/build/pdf.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export type ExtractedPage = {
  pageNumber: number;
  text: string;
};

export type PositionedWord = {
  /** The word's text, punctuation attached, whitespace trimmed. */
  text: string;
  /** Viewport-space (CSS pixels, top-left origin) bounding box. */
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Loads a PDF from bytes into a pdf.js document, ready for per-page work. */
export function loadDocument(data: ArrayBuffer | Uint8Array) {
  return pdfjsLib.getDocument({ data }).promise;
}

/** Loads a PDF from bytes and extracts the plain-text content of every page. */
export async function extractPages(data: ArrayBuffer | Uint8Array): Promise<ExtractedPage[]> {
  const doc = await loadDocument(data);
  const pages: ExtractedPage[] = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");

    pages.push({ pageNumber, text });
  }

  return pages;
}

/**
 * Extracts words with viewport-space bounding boxes (CSS pixels, top-left
 * origin, matching the given viewport's scale/rotation) for overlay
 * positioning.
 *
 * pdf.js's text-content API reports one bounding box per text run, which may
 * span several words, not per glyph — so a run's width is distributed across
 * its words proportionally by character count. That's an approximation for
 * proportional-width fonts, but it's the standard practical technique for
 * word-level highlight overlays without a full glyph-metrics engine.
 */
export async function getPositionedWords(
  page: PDFPageProxy,
  viewport: PageViewport,
): Promise<PositionedWord[]> {
  const content = await page.getTextContent();
  const words: PositionedWord[] = [];

  for (const item of content.items) {
    if (!("str" in item) || item.str.trim() === "") continue;

    // item.width/height are already in final PDF user-space units (the same
    // frame as e/f) — pdf.js has already folded the font-size scale in, so
    // a run's box is built by walking along its baseline/ascent directions
    // rather than re-applying the transform's scale a second time.
    const [a, b, c, d, e, f] = item.transform;
    const hLen = Math.hypot(a, b) || 1;
    const vLen = Math.hypot(c, d) || 1;
    const hDir = [a / hLen, b / hLen];
    const vDir = [c / vLen, d / vLen];
    const runWidth = item.width;
    const runHeight = item.height;
    const runLength = item.str.length;

    const toPagePoint = (u: number, v: number): [number, number] => [
      e + u * hDir[0] + v * vDir[0],
      f + u * hDir[1] + v * vDir[1],
    ];

    let charOffset = 0;
    for (const token of item.str.split(/(\s+)/)) {
      if (token.trim() === "") {
        charOffset += token.length;
        continue;
      }

      const uStart = (charOffset / runLength) * runWidth;
      const uEnd = ((charOffset + token.length) / runLength) * runWidth;
      charOffset += token.length;

      const viewportCorners = [
        toPagePoint(uStart, 0),
        toPagePoint(uEnd, 0),
        toPagePoint(uStart, runHeight),
        toPagePoint(uEnd, runHeight),
      ].map((p) => {
        pdfjsLib.Util.applyTransform(p, viewport.transform);
        return p;
      });

      const xs = viewportCorners.map(([x]) => x);
      const ys = viewportCorners.map(([, y]) => y);
      const x = Math.min(...xs);
      const y = Math.min(...ys);

      words.push({
        text: token,
        x,
        y,
        width: Math.max(...xs) - x,
        height: Math.max(...ys) - y,
      });
    }
  }

  return words;
}
