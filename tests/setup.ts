import * as pdfjsWorker from "pdfjs-dist/legacy/build/pdf.worker.mjs";

// pdf.js runs its worker on a real Worker thread in the browser (see
// src/lib/pdf.ts). jsdom has no Worker/fetch-able asset URLs, so tests wire
// the worker module in directly — pdf.js detects `globalThis.pdfjsWorker`
// and runs it on the main thread instead of spawning one.
(globalThis as unknown as { pdfjsWorker: typeof pdfjsWorker }).pdfjsWorker = pdfjsWorker;
