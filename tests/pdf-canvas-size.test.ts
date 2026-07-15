import { describe, expect, it } from "vitest";
import { computeCanvasSize } from "../src/lib/pdf";

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
