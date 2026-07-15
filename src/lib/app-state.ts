import type { PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { CompareResult } from "./compare";

export type AppState =
  | { phase: "empty" }
  | { phase: "need-second-file"; fileA: File }
  | { phase: "error"; message: string }
  | { phase: "loading" }
  | {
      phase: "ready";
      fileNameA: string;
      fileNameB: string;
      docA: PDFDocumentProxy;
      docB: PDFDocumentProxy;
      result: CompareResult;
      pageCountMessage: string | null;
    };

export type AppAction =
  | { type: "FILES_INVALID"; message: string }
  | { type: "NEED_SECOND_FILE"; fileA: File }
  | { type: "LOADING" }
  | {
      type: "DOCS_READY";
      fileNameA: string;
      fileNameB: string;
      docA: PDFDocumentProxy;
      docB: PDFDocumentProxy;
      result: CompareResult;
      pageCountMessage: string | null;
    }
  | { type: "LOAD_FAILED"; message: string }
  | { type: "RESET" };

export const initialAppState: AppState = { phase: "empty" };

export function appReducer(_state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "FILES_INVALID":
      return { phase: "error", message: action.message };
    case "NEED_SECOND_FILE":
      return { phase: "need-second-file", fileA: action.fileA };
    case "LOADING":
      return { phase: "loading" };
    case "DOCS_READY":
      return {
        phase: "ready",
        fileNameA: action.fileNameA,
        fileNameB: action.fileNameB,
        docA: action.docA,
        docB: action.docB,
        result: action.result,
        pageCountMessage: action.pageCountMessage,
      };
    case "LOAD_FAILED":
      return { phase: "error", message: action.message };
    case "RESET":
      return { phase: "empty" };
  }
}
