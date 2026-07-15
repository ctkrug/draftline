import type { PositionedDiffOp } from "./positioned-diff";

export type OverlayMark =
  | { type: "insert"; x: number; y: number; width: number; height: number }
  | { type: "delete"; text: string; x: number; y: number; height: number };

type Anchor = { x: number; y: number; height: number };

/**
 * Turns diff ops into overlay marks positioned against the *revised*
 * document's rendered page. Insertions have a real box (the word exists in
 * the revised page). Deletions don't — the word was removed — so consecutive
 * deleted words are grouped into one marker anchored at the point of the
 * edit: the right edge of the nearest preceding kept/inserted word, or the
 * left edge of the next one if the deletion opens the page.
 */
export function buildOverlayMarks(ops: PositionedDiffOp[]): OverlayMark[] {
  const marks: OverlayMark[] = [];
  let lastAnchor: Anchor | null = null;
  let i = 0;

  while (i < ops.length) {
    const op = ops[i];

    if (op.type === "equal") {
      lastAnchor = { x: op.wordB.x + op.wordB.width, y: op.wordB.y, height: op.wordB.height };
      i++;
      continue;
    }

    if (op.type === "insert") {
      marks.push({ type: "insert", x: op.word.x, y: op.word.y, width: op.word.width, height: op.word.height });
      lastAnchor = { x: op.word.x + op.word.width, y: op.word.y, height: op.word.height };
      i++;
      continue;
    }

    const words: string[] = [];
    while (i < ops.length && ops[i].type === "delete") {
      const deleteOp = ops[i];
      if (deleteOp.type === "delete") words.push(deleteOp.word.text);
      i++;
    }

    const anchor = lastAnchor ?? findForwardAnchor(ops, i);
    marks.push({ type: "delete", text: words.join(" "), x: anchor.x, y: anchor.y, height: anchor.height });
  }

  return marks;
}

function findForwardAnchor(ops: PositionedDiffOp[], fromIndex: number): Anchor {
  for (let j = fromIndex; j < ops.length; j++) {
    const op = ops[j];
    if (op.type === "equal") return { x: op.wordB.x, y: op.wordB.y, height: op.wordB.height };
    if (op.type === "insert") return { x: op.word.x, y: op.word.y, height: op.word.height };
  }
  return { x: 0, y: 0, height: 12 };
}
