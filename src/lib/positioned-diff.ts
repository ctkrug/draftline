import type { PositionedWord } from "./pdf";

export type PositionedDiffOp =
  | { type: "equal"; wordA: PositionedWord; wordB: PositionedWord }
  | { type: "delete"; word: PositionedWord }
  | { type: "insert"; word: PositionedWord };

/**
 * Word-level diff over positioned tokens, one op per word (never merged), so
 * each insert/delete carries its own source bounding box. This is what lets
 * the overlay renderer highlight a changed clause even when it spans a line
 * break: two words on different lines stay two separate ops with two
 * separate boxes instead of collapsing into one incorrect span.
 *
 * Matching is by word text only, mirroring diffWords' LCS approach — the
 * position is metadata carried alongside the match, not part of it.
 */
export function diffPositionedWords(a: PositionedWord[], b: PositionedWord[]): PositionedDiffOp[] {
  const lengths: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );

  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lengths[i][j] =
        a[i].text === b[j].text
          ? lengths[i + 1][j + 1] + 1
          : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    }
  }

  const ops: PositionedDiffOp[] = [];
  let i = 0;
  let j = 0;

  while (i < a.length && j < b.length) {
    if (a[i].text === b[j].text) {
      ops.push({ type: "equal", wordA: a[i], wordB: b[j] });
      i++;
      j++;
    } else if (lengths[i + 1][j] >= lengths[i][j + 1]) {
      ops.push({ type: "delete", word: a[i] });
      i++;
    } else {
      ops.push({ type: "insert", word: b[j] });
      j++;
    }
  }

  while (i < a.length) {
    ops.push({ type: "delete", word: a[i] });
    i++;
  }

  while (j < b.length) {
    ops.push({ type: "insert", word: b[j] });
    j++;
  }

  return ops;
}
