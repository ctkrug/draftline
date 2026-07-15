import { describe, expect, it } from "vitest";
import { diffPositionedWords } from "../src/lib/positioned-diff";
import { getPositionedWords, loadDocument } from "../src/lib/pdf";
import { buildPdf } from "./helpers/pdf-builder";
import type { PositionedWord } from "../src/lib/pdf";

function word(text: string, x: number, y = 0): PositionedWord {
  return { text, x, y, width: 10, height: 12 };
}

describe("diffPositionedWords", () => {
  it("returns all-equal ops for identical word lists", () => {
    const a = [word("the", 0), word("tenant", 10)];
    const b = [word("the", 0), word("tenant", 10)];

    const ops = diffPositionedWords(a, b);

    expect(ops).toEqual([
      { type: "equal", wordA: a[0], wordB: b[0] },
      { type: "equal", wordA: a[1], wordB: b[1] },
    ]);
  });

  it("isolates a single changed word as a delete+insert pair", () => {
    const a = [word("the"), word("tenant"), word("shall"), word("pay"), word("rent")];
    const b = [word("the"), word("tenant"), word("may"), word("pay"), word("rent")];

    const ops = diffPositionedWords(a, b);

    expect(ops.map((op) => op.type)).toEqual(["equal", "equal", "delete", "insert", "equal", "equal"]);
    expect(ops[2]).toEqual({ type: "delete", word: a[2] });
    expect(ops[3]).toEqual({ type: "insert", word: b[2] });
  });

  it("returns an empty array when both sides are empty", () => {
    expect(diffPositionedWords([], [])).toEqual([]);
  });

  it("marks every word as inserted when the original has none", () => {
    const b = [word("new"), word("clause")];
    expect(diffPositionedWords([], b)).toEqual([
      { type: "insert", word: b[0] },
      { type: "insert", word: b[1] },
    ]);
  });

  it("keeps a changed word's real box even when the edit spans a line break", async () => {
    const bytesA = buildPdf([
      {
        items: [
          { text: "Alpha Beta", x: 72, y: 700, size: 12 },
          { text: "Gamma Delta", x: 72, y: 680, size: 12 },
        ],
      },
    ]);
    const bytesB = buildPdf([
      {
        items: [
          { text: "Alpha Zeta", x: 72, y: 700, size: 12 },
          { text: "Omega Delta", x: 72, y: 680, size: 12 },
        ],
      },
    ]);

    const [docA, docB] = await Promise.all([loadDocument(bytesA), loadDocument(bytesB)]);
    const [pageA, pageB] = await Promise.all([docA.getPage(1), docB.getPage(1)]);
    const viewport = pageA.getViewport({ scale: 1 });
    const [wordsA, wordsB] = await Promise.all([
      getPositionedWords(pageA, viewport),
      getPositionedWords(pageB, viewport),
    ]);

    const ops = diffPositionedWords(wordsA, wordsB);
    const deletes = ops.filter((op) => op.type === "delete");
    const inserts = ops.filter((op) => op.type === "insert");

    // "Beta" (line 1) and "Gamma" (line 2) are both removed — they must stay
    // two distinct boxes on their own lines, not merge into one span.
    expect(deletes.map((op) => op.word.text)).toEqual(["Beta", "Gamma"]);
    expect(deletes[0].word.y).not.toBeCloseTo(deletes[1].word.y);

    expect(inserts.map((op) => op.word.text)).toEqual(["Zeta", "Omega"]);
    expect(inserts[0].word.y).toBeCloseTo(deletes[0].word.y);
    expect(inserts[1].word.y).toBeCloseTo(deletes[1].word.y);
  });
});
