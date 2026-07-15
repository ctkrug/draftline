import { describe, expect, it } from "vitest";
import { extractPages, loadDocument } from "../src/lib/pdf";
import { buildPdf } from "./helpers/pdf-builder";

describe("extractPages", () => {
  it("extracts per-page text content matching the fixture's known text", async () => {
    const bytes = buildPdf([
      { items: [{ text: "Hello World", x: 72, y: 700 }] },
      { items: [{ text: "Second page", x: 72, y: 700 }] },
    ]);

    const pages = await extractPages(bytes);

    expect(pages).toHaveLength(2);
    expect(pages[0].pageNumber).toBe(1);
    expect(pages[0].text).toContain("Hello World");
    expect(pages[1].pageNumber).toBe(2);
    expect(pages[1].text).toContain("Second page");
  });

  it("returns an empty-text page for a scanned/image-only PDF with no text layer", async () => {
    const bytes = buildPdf([{ items: [] }]);

    const pages = await extractPages(bytes);

    expect(pages).toHaveLength(1);
    expect(pages[0].text.trim()).toBe("");
  });

  it("keeps literal parentheses in extracted text, a common clause pattern", async () => {
    const bytes = buildPdf([
      { items: [{ text: `the Tenant (as defined below)`, x: 72, y: 700 }] },
    ]);

    const pages = await extractPages(bytes);

    expect(pages[0].text).toContain("(as defined below)");
  });
});

describe("loadDocument", () => {
  it("rejects with an error for garbage bytes that aren't a PDF at all", async () => {
    const garbage = new Uint8Array([1, 2, 3, 4, 5]);
    await expect(loadDocument(garbage)).rejects.toThrow();
  });

  it("rejects with an error for a zero-byte file", async () => {
    await expect(loadDocument(new Uint8Array(0))).rejects.toThrow();
  });
});
