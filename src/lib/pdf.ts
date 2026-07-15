// The legacy build avoids assuming DOMMatrix/OffscreenCanvas are globally
// present, which keeps it working under both jsdom (tests) and browsers.
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfjsWorker from "pdfjs-dist/legacy/build/pdf.worker.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export type ExtractedPage = {
  pageNumber: number;
  text: string;
};

/** Loads a PDF from bytes and extracts the plain-text content of every page. */
export async function extractPages(data: ArrayBuffer | Uint8Array): Promise<ExtractedPage[]> {
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const pages: ExtractedPage[] = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");

    pages.push({ pageNumber, text });
  }

  return pages;
}
