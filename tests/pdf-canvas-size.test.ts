import { describe, expect, it } from "vitest";
import { computeCanvasSize, renderPageToCanvas } from "../src/lib/pdf";
import type { PDFPageProxy, PageViewport } from "pdfjs-dist/legacy/build/pdf.mjs";

describe("computeCanvasSize", () => {
  it("scales height proportionally to the target CSS width", () => {
    const size = computeCanvasSize(612, 792, 306, 1);

    expect(size.scale).toBeCloseTo(0.5);
    expect(size.cssWidth).toBe(306);
    expect(size.cssHeight).toBeCloseTo(396);
  });

  it("multiplies canvas backing-store dimensions by the pixel ratio", () => {
    const size = computeCanvasSize(612, 792, 306, 2);

    expect(size.canvasWidth).toBe(612);
    expect(size.canvasHeight).toBe(792);
  });

  it("handles a pixel ratio of zero without dividing by zero", () => {
    const size = computeCanvasSize(612, 792, 306, 0);

    expect(size.canvasWidth).toBe(0);
    expect(size.canvasHeight).toBe(0);
  });
});

describe("renderPageToCanvas", () => {
  it("throws a clear error when the canvas has no 2D context available", async () => {
    // jsdom has no canvas backend installed, so getContext("2d") returns
    // null here exactly as it would for an exhausted/unsupported context in
    // a real browser — this exercises that guard for real.
    const fakePage = {
      getViewport: () => ({ width: 612, height: 792, scale: 1 }) as PageViewport,
    } as unknown as PDFPageProxy;
    const canvas = document.createElement("canvas");

    await expect(renderPageToCanvas(fakePage, canvas, 306, 1)).rejects.toThrow(
      "Canvas 2D context is unavailable",
    );
  });
});
