import { describe, expect, it } from "vitest";
import { extractPages } from "../src/lib/pdf";
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
});
