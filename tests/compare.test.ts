import { describe, expect, it } from "vitest";
import { compareDocuments, describePageCountDifference } from "../src/lib/compare";
import { loadDocument } from "../src/lib/pdf";
import { buildPdf } from "./helpers/pdf-builder";

describe("compareDocuments", () => {
  it("reports no changes for identical documents", async () => {
    const bytes = buildPdf([{ items: [{ text: "the tenant shall pay rent", x: 72, y: 700 }] }]);
    const [docA, docB] = await Promise.all([loadDocument(bytes), loadDocument(bytes)]);

    const result = await compareDocuments(docA, docB);

    expect(result.pageCount).toEqual({ a: 1, b: 1 });
    expect(result.totals).toEqual({ additions: 0, deletions: 0, pagesChanged: 0 });
    expect(result.pages).toEqual([
      expect.objectContaining({ status: "compared", pageNumber: 1, hasChanges: false }),
    ]);
  });

  it("counts additions and deletions for a changed clause", async () => {
    const bytesA = buildPdf([{ items: [{ text: "the tenant shall pay rent", x: 72, y: 700 }] }]);
    const bytesB = buildPdf([{ items: [{ text: "the tenant may pay rent", x: 72, y: 700 }] }]);
    const [docA, docB] = await Promise.all([loadDocument(bytesA), loadDocument(bytesB)]);

    const result = await compareDocuments(docA, docB);
    const page = result.pages[0];

    expect(page.status).toBe("compared");
    if (page.status === "compared") {
      expect(page.additions).toBe(1);
      expect(page.deletions).toBe(1);
      expect(page.hasChanges).toBe(true);
    }
    expect(result.totals).toEqual({ additions: 1, deletions: 1, pagesChanged: 1 });
  });

  it("marks extra pages in the longer document as added, not dropped", async () => {
    const bytesA = buildPdf([{ items: [{ text: "page one", x: 72, y: 700 }] }]);
    const bytesB = buildPdf([
      { items: [{ text: "page one", x: 72, y: 700 }] },
      { items: [{ text: "page two", x: 72, y: 700 }] },
      { items: [{ text: "page three", x: 72, y: 700 }] },
    ]);
    const [docA, docB] = await Promise.all([loadDocument(bytesA), loadDocument(bytesB)]);

    const result = await compareDocuments(docA, docB);

    expect(result.pageCount).toEqual({ a: 1, b: 3 });
    expect(result.pages).toHaveLength(3);
    expect(result.pages[1]).toEqual({ status: "added", pageNumber: 2 });
    expect(result.pages[2]).toEqual({ status: "added", pageNumber: 3 });
    expect(result.totals.pagesChanged).toBe(2);
  });

  it("marks pages missing from the longer document as removed", async () => {
    const bytesA = buildPdf([
      { items: [{ text: "page one", x: 72, y: 700 }] },
      { items: [{ text: "page two", x: 72, y: 700 }] },
    ]);
    const bytesB = buildPdf([{ items: [{ text: "page one", x: 72, y: 700 }] }]);
    const [docA, docB] = await Promise.all([loadDocument(bytesA), loadDocument(bytesB)]);

    const result = await compareDocuments(docA, docB);

    expect(result.pages[1]).toEqual({ status: "removed", pageNumber: 2 });
  });

  it("streams each page result via onPage as it completes", async () => {
    const bytesA = buildPdf([
      { items: [{ text: "page one", x: 72, y: 700 }] },
      { items: [{ text: "page two", x: 72, y: 700 }] },
    ]);
    const bytesB = buildPdf([
      { items: [{ text: "page one", x: 72, y: 700 }] },
      { items: [{ text: "page two revised", x: 72, y: 700 }] },
    ]);
    const [docA, docB] = await Promise.all([loadDocument(bytesA), loadDocument(bytesB)]);

    const streamed: Array<{ pageNumber: number; index: number; total: number }> = [];
    const result = await compareDocuments(docA, docB, (page, index, total) => {
      streamed.push({ pageNumber: page.pageNumber, index, total });
    });

    expect(streamed).toEqual([
      { pageNumber: 1, index: 0, total: 2 },
      { pageNumber: 2, index: 1, total: 2 },
    ]);
    expect(result.pages).toHaveLength(2);
  });
});

describe("describePageCountDifference", () => {
  it("returns null when page counts match", () => {
    expect(describePageCountDifference(5, 5)).toBeNull();
  });

  it("describes document B having more pages", () => {
    expect(describePageCountDifference(2, 5)).toBe("Document B has 3 more pages than Document A");
  });

  it("describes document A having more pages", () => {
    expect(describePageCountDifference(5, 2)).toBe("Document A has 3 more pages than Document B");
  });

  it("uses singular 'page' for a one-page difference", () => {
    expect(describePageCountDifference(4, 5)).toBe("Document B has 1 more page than Document A");
  });
});
