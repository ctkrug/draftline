# Draftline

[![CI](https://github.com/ctkrug/draftline/actions/workflows/ci.yml/badge.svg)](https://github.com/ctkrug/draftline/actions/workflows/ci.yml)

Drop in two versions of a PDF — a contract redline, a lease draft, a policy revision — and watch
every changed clause highlight directly on the original page images. No upload, no page cap, no
account. Everything happens in your browser.

## What it is

Redlining a contract usually means either trusting a paid SaaS tool with your document, or
squinting at two PDFs side by side trying to spot what moved. Draftline does the comparison
entirely client-side: it extracts the text layer from both PDFs with [pdf.js](https://mozilla.github.io/pdf.js/),
diffs it clause by clause, and re-renders the diff as red/green highlights layered directly over
the original rendered page images — so you see the change in its real typographic context, not a
plain-text dump.

Because the diff runs in the browser, files never leave your machine. There's no server-side
processing, no page-count limit, and no monthly quota.

## Why

Every existing "PDF diff" tool either uploads your files to a server (a non-starter for anything
under NDA — leases, contracts, term sheets) or caps you at a handful of free pages before asking
for a subscription. Draftline has neither constraint, because it doesn't need a backend at all.

## Features

- **Drag-and-drop compare** — drop two PDFs (or pick via file input) and get a highlighted diff
  in seconds, no upload spinner.
- **Text-layer extraction** — pull structured text + position data from each page via pdf.js.
- **Clause-level diff** — a diff algorithm tuned for prose (word/phrase granularity, not raw
  character diffing) so a single edited word doesn't light up the whole paragraph.
- **Overlay rendering** — paints additions in place over the revised page and deletions as a
  strikethrough marker at the edit point, positioned using the original text's bounding boxes.
- **Page navigation** — jump between pages that contain changes; a running total of additions
  and deletions.
- **Graceful degradation** — mismatched page counts, scanned/image-only pages, and 50+ page
  documents are all handled without crashing or freezing the page (with a cancel control for
  long comparisons).
- **Zero page cap, zero upload** — designed to handle full-length contracts and leases, not just
  short samples, entirely offline once loaded.

## Using it

```bash
npm install
npm run dev
```

Open the dev server URL, then drop (or pick) two PDF versions of the same document. Draftline
renders the revised document's pages with the diff painted directly on top: green boxes over
inserted text, red strikethrough markers where text was removed. Use the page navigator in the
left rail to jump to any page — pages with changes are marked with a dot.

Build a deployable static bundle with `npm run build` (outputs to `dist/`); preview it with
`npm run preview`.

## Stack

- **TypeScript** — the whole app, strictly typed.
- **pdf.js** — PDF parsing and page rendering (Mozilla's PDF renderer, the same engine behind
  Firefox's built-in PDF viewer).
- **Vite** — dev server and static build; ships to a single self-contained `dist/` directory.
- **Vitest** — unit tests for the diff engine and text-extraction pipeline.

No backend. No database. No accounts. Static site, hosted anywhere.

## Status

Core compare experience complete — see [`docs/VISION.md`](docs/VISION.md) for the full plan,
[`docs/BACKLOG.md`](docs/BACKLOG.md) for the story breakdown, and
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for how the pieces fit together.

## License

MIT — see [LICENSE](LICENSE).
