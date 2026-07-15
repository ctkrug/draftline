import { describe, expect, it } from "vitest";
import { buildOverlayMarks } from "../src/lib/overlay";
import type { PositionedWord } from "../src/lib/pdf";
import type { PositionedDiffOp } from "../src/lib/positioned-diff";

function word(text: string, x: number, y = 0, width = 10, height = 12): PositionedWord {
  return { text, x, y, width, height };
}

describe("buildOverlayMarks", () => {
  it("returns no marks for an all-equal diff", () => {
    const ops: PositionedDiffOp[] = [
      { type: "equal", wordA: word("the", 0), wordB: word("the", 0) },
    ];
    expect(buildOverlayMarks(ops)).toEqual([]);
  });

  it("places an insert mark directly over the inserted word's own box", () => {
    const ops: PositionedDiffOp[] = [{ type: "insert", word: word("may", 40, 5, 20, 12) }];

    expect(buildOverlayMarks(ops)).toEqual([
      { type: "insert", x: 40, y: 5, width: 20, height: 12 },
    ]);
  });

  it("anchors a delete mark at the end of the preceding equal word", () => {
    const ops: PositionedDiffOp[] = [
      { type: "equal", wordA: word("the", 0), wordB: word("the", 0, 0, 20, 12) },
      { type: "delete", word: word("shall", 20) },
    ];

    expect(buildOverlayMarks(ops)).toEqual([
      { type: "delete", text: "shall", x: 20, y: 0, height: 12 },
    ]);
  });

  it("groups consecutive deletions into a single mark with joined text", () => {
    const ops: PositionedDiffOp[] = [
      { type: "equal", wordA: word("the", 0), wordB: word("the", 0, 0, 20, 12) },
      { type: "delete", word: word("shall", 20) },
      { type: "delete", word: word("not", 40) },
      { type: "equal", wordA: word("pay", 60), wordB: word("pay", 60, 0, 20, 12) },
    ];

    const marks = buildOverlayMarks(ops);

    expect(marks).toEqual([{ type: "delete", text: "shall not", x: 20, y: 0, height: 12 }]);
  });

  it("anchors a leading delete at the next word when there is no preceding one", () => {
    const ops: PositionedDiffOp[] = [
      { type: "delete", word: word("Whereas", 0) },
      { type: "equal", wordA: word("the", 40), wordB: word("the", 40, 0, 20, 12) },
    ];

    expect(buildOverlayMarks(ops)).toEqual([
      { type: "delete", text: "Whereas", x: 40, y: 0, height: 12 },
    ]);
  });

  it("falls back to the page origin when a page is deletions-only", () => {
    const ops: PositionedDiffOp[] = [{ type: "delete", word: word("Removed", 0) }];

    expect(buildOverlayMarks(ops)).toEqual([
      { type: "delete", text: "Removed", x: 0, y: 0, height: 12 },
    ]);
  });

  it("anchors a leading delete at the next word's box when it's an insert, not an equal", () => {
    const ops: PositionedDiffOp[] = [
      { type: "delete", word: word("Whereas", 0) },
      { type: "insert", word: word("Therefore", 40, 5, 30, 14) },
    ];

    expect(buildOverlayMarks(ops)).toEqual([
      { type: "delete", text: "Whereas", x: 40, y: 5, height: 14 },
      { type: "insert", x: 40, y: 5, width: 30, height: 14 },
    ]);
  });
});
