import { describe, expect, it } from "vitest";
import { getPositionedWords, loadDocument } from "../src/lib/pdf";
import { buildPdf } from "./helpers/pdf-builder";

describe("getPositionedWords", () => {
  it("maps a single-word text run to its exact viewport-space box", async () => {
    const bytes = buildPdf([{ items: [{ text: "Alpha", x: 72, y: 700, size: 12 }] }]);
    const doc = await loadDocument(bytes);
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 1 });

    const words = await getPositionedWords(page, viewport);

    expect(words).toHaveLength(1);
    expect(words[0].text).toBe("Alpha");
    // Unrotated scale-1 viewport flips y around the page height (792): a
    // word whose PDF-space origin is (72, 700) with a 12pt line height lands
    // with its top-left corner at (72, 792 - 700 - 12) = (72, 80).
    expect(words[0].x).toBeCloseTo(72);
    expect(words[0].y).toBeCloseTo(80);
    expect(words[0].height).toBeCloseTo(12);
    expect(words[0].width).toBeGreaterThan(0);
  });

  it("splits a multi-word text run into separately positioned, non-overlapping words", async () => {
    const bytes = buildPdf([{ items: [{ text: "Alpha Beta", x: 72, y: 700, size: 12 }] }]);
    const doc = await loadDocument(bytes);
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 1 });

    const words = await getPositionedWords(page, viewport);

    expect(words.map((w) => w.text)).toEqual(["Alpha", "Beta"]);
    expect(words[0].x).toBeCloseTo(72);
    expect(words[1].x).toBeGreaterThan(words[0].x + words[0].width);
  });

  it("keeps words on different lines at different y positions, not merged", async () => {
    const bytes = buildPdf([
      {
        items: [
          { text: "First line", x: 72, y: 700, size: 12 },
          { text: "Second line", x: 72, y: 680, size: 12 },
        ],
      },
    ]);
    const doc = await loadDocument(bytes);
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 1 });

    const words = await getPositionedWords(page, viewport);
    const firstLineWords = words.filter((w) => w.text === "First" || w.text === "line");
    const secondLineWords = words.filter((w) => w.text === "Second");

    expect(firstLineWords[0].y).not.toBeCloseTo(secondLineWords[0].y);
  });

  it("returns an empty array for a page with no text", async () => {
    const bytes = buildPdf([{ items: [] }]);
    const doc = await loadDocument(bytes);
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 1 });

    const words = await getPositionedWords(page, viewport);

    expect(words).toEqual([]);
  });

  it("skips a whitespace-only text run instead of emitting an empty word", async () => {
    const bytes = buildPdf([{ items: [{ text: "   ", x: 72, y: 700, size: 12 }] }]);
    const doc = await loadDocument(bytes);
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 1 });

    const words = await getPositionedWords(page, viewport);

    expect(words).toEqual([]);
  });
});
