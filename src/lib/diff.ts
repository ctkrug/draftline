export type DiffOp = {
  type: "equal" | "insert" | "delete";
  value: string;
};

/**
 * Word-level diff tuned for prose: tokens are words + the whitespace/punctuation
 * that follows them, so a single edited word doesn't cause the whole sentence
 * to re-flow into one giant "changed" span.
 */
export function tokenize(text: string): string[] {
  return text.match(/\S+\s*/g) ?? [];
}

/**
 * Longest common subsequence diff over word tokens. O(n*m) — fine for
 * clause-sized chunks; the caller is expected to diff page-by-page or
 * clause-by-clause rather than whole-document strings.
 */
export function diffWords(a: string, b: string): DiffOp[] {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);

  const lengths: number[][] = Array.from({ length: tokensA.length + 1 }, () =>
    new Array<number>(tokensB.length + 1).fill(0),
  );

  for (let i = tokensA.length - 1; i >= 0; i--) {
    for (let j = tokensB.length - 1; j >= 0; j--) {
      lengths[i][j] =
        tokensA[i] === tokensB[j]
          ? lengths[i + 1][j + 1] + 1
          : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    }
  }

  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;

  while (i < tokensA.length && j < tokensB.length) {
    if (tokensA[i] === tokensB[j]) {
      ops.push({ type: "equal", value: tokensA[i] });
      i++;
      j++;
    } else if (lengths[i + 1][j] >= lengths[i][j + 1]) {
      ops.push({ type: "delete", value: tokensA[i] });
      i++;
    } else {
      ops.push({ type: "insert", value: tokensB[j] });
      j++;
    }
  }

  while (i < tokensA.length) {
    ops.push({ type: "delete", value: tokensA[i] });
    i++;
  }

  while (j < tokensB.length) {
    ops.push({ type: "insert", value: tokensB[j] });
    j++;
  }

  return mergeAdjacent(ops);
}

/** Collapse runs of the same op type into a single token for cheaper rendering. */
function mergeAdjacent(ops: DiffOp[]): DiffOp[] {
  const merged: DiffOp[] = [];

  for (const op of ops) {
    const last = merged[merged.length - 1];
    if (last && last.type === op.type) {
      last.value += op.value;
    } else {
      merged.push({ ...op });
    }
  }

  return merged;
}
