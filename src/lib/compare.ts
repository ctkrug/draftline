import { getPositionedWords } from "./pdf";
import { diffPositionedWords } from "./positioned-diff";
import type { PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PositionedDiffOp } from "./positioned-diff";

export type PageCompareResult =
  | {
      status: "compared";
      pageNumber: number;
      ops: PositionedDiffOp[];
      additions: number;
      deletions: number;
      hasChanges: boolean;
    }
  | { status: "added"; pageNumber: number }
  | { status: "removed"; pageNumber: number };

export type CompareResult = {
  pageCount: { a: number; b: number };
  pages: PageCompareResult[];
  totals: { additions: number; deletions: number; pagesChanged: number };
};

function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Diffs every page of two documents. Boxes on `PageCompareResult.ops` are in
 * each page's own scale-1 viewport space — callers rendering at a different
 * CSS width just multiply x/y/width/height by their render scale, since a
 * pdf.js viewport's transform scales linearly (see renderPageToCanvas).
 *
 * Pages beyond the shorter document's page count are reported as "added" or
 * "removed" rather than silently dropped.
 *
 * Calls `onPage` as each page finishes and yields to the event loop between
 * pages, so a long document (BACKLOG 2.3) doesn't block the main thread for
 * its whole length — callers can render page 1 the moment it's ready instead
 * of waiting on all of them. Pass `signal` to let a cancel control stay
 * responsive throughout: an aborted signal stops before the next page starts
 * and throws the signal's abort reason (an `AbortError` by default).
 */
export async function compareDocuments(
  docA: PDFDocumentProxy,
  docB: PDFDocumentProxy,
  onPage?: (page: PageCompareResult, index: number, total: number) => void,
  signal?: AbortSignal,
): Promise<CompareResult> {
  const pageCount = { a: docA.numPages, b: docB.numPages };
  const pages: PageCompareResult[] = [];
  const totals = { additions: 0, deletions: 0, pagesChanged: 0 };

  const maxPages = Math.max(pageCount.a, pageCount.b);

  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber++) {
    signal?.throwIfAborted();

    let pageResult: PageCompareResult;

    if (pageNumber > pageCount.a) {
      pageResult = { status: "added", pageNumber };
      totals.pagesChanged++;
    } else if (pageNumber > pageCount.b) {
      pageResult = { status: "removed", pageNumber };
      totals.pagesChanged++;
    } else {
      const [pageA, pageB] = await Promise.all([docA.getPage(pageNumber), docB.getPage(pageNumber)]);
      const [wordsA, wordsB] = await Promise.all([
        getPositionedWords(pageA, pageA.getViewport({ scale: 1 })),
        getPositionedWords(pageB, pageB.getViewport({ scale: 1 })),
      ]);

      const ops = diffPositionedWords(wordsA, wordsB);
      const additions = ops.filter((op) => op.type === "insert").length;
      const deletions = ops.filter((op) => op.type === "delete").length;
      const hasChanges = additions > 0 || deletions > 0;

      pageResult = { status: "compared", pageNumber, ops, additions, deletions, hasChanges };
      totals.additions += additions;
      totals.deletions += deletions;
      if (hasChanges) totals.pagesChanged++;
    }

    pages.push(pageResult);
    onPage?.(pageResult, pageNumber - 1, maxPages);
    if (pageNumber < maxPages) await yieldToMainThread();
  }

  return { pageCount, pages, totals };
}

/** A human-readable banner for a page-count mismatch, or null if counts match. */
export function describePageCountDifference(pageCountA: number, pageCountB: number): string | null {
  if (pageCountA === pageCountB) return null;

  const [longer, shorter, diff] =
    pageCountB > pageCountA
      ? (["B", "A", pageCountB - pageCountA] as const)
      : (["A", "B", pageCountA - pageCountB] as const);

  const pageWord = diff === 1 ? "page" : "pages";
  return `Document ${longer} has ${diff} more ${pageWord} than Document ${shorter}`;
}
