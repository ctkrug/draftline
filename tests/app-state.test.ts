import { describe, expect, it } from "vitest";
import { appReducer, initialAppState } from "../src/lib/app-state";
import type { AppState } from "../src/lib/app-state";
import type { CompareResult } from "../src/lib/compare";
import type { PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";

const fakeDoc = {} as PDFDocumentProxy;
const fakeResult: CompareResult = {
  pageCount: { a: 1, b: 1 },
  pages: [],
  totals: { additions: 0, deletions: 0, pagesChanged: 0 },
};

describe("appReducer", () => {
  it("starts in the empty phase", () => {
    expect(initialAppState).toEqual({ phase: "empty" });
  });

  it("moves to the error phase on FILES_INVALID", () => {
    const state = appReducer(initialAppState, { type: "FILES_INVALID", message: "bad file" });
    expect(state).toEqual({ phase: "error", message: "bad file" });
  });

  it("moves to need-second-file, carrying the first file", () => {
    const file = new File(["%PDF"], "a.pdf", { type: "application/pdf" });
    const state = appReducer(initialAppState, { type: "NEED_SECOND_FILE", fileA: file });
    expect(state).toEqual({ phase: "need-second-file", fileA: file });
  });

  it("moves to loading", () => {
    expect(appReducer(initialAppState, { type: "LOADING" })).toEqual({ phase: "loading" });
  });

  it("moves to ready with the comparison result on DOCS_READY", () => {
    const state = appReducer(
      { phase: "loading" },
      {
        type: "DOCS_READY",
        fileNameA: "original.pdf",
        fileNameB: "revised.pdf",
        docA: fakeDoc,
        docB: fakeDoc,
        result: fakeResult,
        pageCountMessage: null,
      },
    );

    expect(state).toEqual({
      phase: "ready",
      fileNameA: "original.pdf",
      fileNameB: "revised.pdf",
      docA: fakeDoc,
      docB: fakeDoc,
      result: fakeResult,
      pageCountMessage: null,
    });
  });

  it("moves to the error phase on LOAD_FAILED from any prior state", () => {
    const priorStates: AppState[] = [
      { phase: "loading" },
      { phase: "need-second-file", fileA: new File([], "a.pdf") },
    ];

    for (const prior of priorStates) {
      expect(appReducer(prior, { type: "LOAD_FAILED", message: "could not parse PDF" })).toEqual({
        phase: "error",
        message: "could not parse PDF",
      });
    }
  });

  it("resets back to empty from any state", () => {
    expect(appReducer({ phase: "error", message: "x" }, { type: "RESET" })).toEqual({
      phase: "empty",
    });
  });
});
