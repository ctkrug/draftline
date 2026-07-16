# Draftline

**▶ Live demo: [apps.charliekrug.com/draftline](https://apps.charliekrug.com/draftline/)**

[![CI](https://github.com/ctkrug/draftline/actions/workflows/ci.yml/badge.svg)](https://github.com/ctkrug/draftline/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-1d4ed8.svg)](LICENSE)

Compare two PDFs and see every changed clause highlighted right on the page. No upload, no page
cap, no account. Draftline runs the whole comparison in your browser, so a confidential lease or
contract never leaves your machine.

![A contract paragraph with Draftline's overlay: the new rent amount in green, the old amount struck through in red](docs/redline-sample.svg)

## Who it's for

You got back a revised lease, a vendor contract, or a statement of work, and you need to know
exactly what changed since the last version. You do not have a legal team, and you are not about
to upload an NDA'd document to some website that caps you at three pages and then asks for a card.
Draftline is for that moment: two drafts in, every edit marked, nothing sent anywhere.

## What it does

Draftline reads the text layer from both PDFs with [pdf.js](https://mozilla.github.io/pdf.js/),
runs a word-level diff, and paints the result directly over the revised document's rendered
pages. You see each change in its real typographic context (column layout, defined terms, section
numbers), not as a stripped-down text dump in two side-by-side boxes.

Because the comparison happens locally, there is no server to send files to, no page limit to hit,
and no quota to run out of.

## Features

- **Nothing is uploaded.** Both files are parsed in the browser with pdf.js. There is no backend,
  no network request carrying your document, and no account to create.
- **Changes show where they happened.** Inserted words get a green box over the actual word in the
  revised page; removed words become a red strikethrough marker anchored at the exact edit point.
- **Word-level diff, not paragraph noise.** An LCS diff over individual words means changing
  "$2,200" to "$2,400" lights up two tokens, not the whole clause around them.
- **No page cap.** A 60-page lease compares the same as a two-page letter. Pages stream in one at
  a time with a Cancel button, so the tab stays responsive on long documents.
- **The messy cases are handled.** A page-count mismatch gets an added/removed banner, and a
  scanned page with no text layer says so plainly instead of silently comparing nothing.

## Using it

```bash
npm install
npm run dev
```

Open the dev server URL, then drop (or pick) two PDF versions of the same document. Draftline
renders the revised document's pages with the diff painted on top: green boxes over inserted text,
red strikethrough markers where text was removed. Use the page navigator in the left rail to jump
to any page; pages that changed are marked with a dot.

Build the static bundle with `npm run build` (outputs to `site/`) and preview it with
`npm run preview`.

## How it fits together

```
two PDFs → validateDroppedFiles → loadDocument ×2 (pdf.js)
         → compareDocuments  (getPositionedWords + diffPositionedWords, page by page)
         → renderPageToCanvas + buildOverlayMarks → highlighted page + navigator
```

Every module in `src/lib/` is a pure, unit-tested unit; `src/main.ts` is the only part that
touches the DOM. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full data flow and
[`docs/VISION.md`](docs/VISION.md) for the design decisions behind it.

## Stack

- **TypeScript**, strictly typed throughout.
- **pdf.js** for PDF parsing and page rendering (Mozilla's renderer, the same engine behind
  Firefox's built-in PDF viewer).
- **Vite** for the dev server and the static build.
- **Vitest** for the diff engine, text-extraction, and DOM-layer tests.

No backend. No database. No accounts. A static site that hosts anywhere.

## Privacy

There is no server component at all. Once the page has loaded, you could disconnect from the
network and every comparison would still work. Your files are read into memory, diffed, and
rendered locally, then discarded when you close the tab.

## License

MIT, see [LICENSE](LICENSE).

---

More of Charlie's projects: [apps.charliekrug.com](https://apps.charliekrug.com)
