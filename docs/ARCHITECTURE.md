# Draftline — Architecture

A static, client-only TypeScript + Vite app. No backend, no build-time
server code — everything in `src/` runs in the browser.

## Data flow

```
File, File (drop zone)
  │
  ▼
validateDroppedFiles()          src/lib/file-validation.ts
  │  (exactly 2 PDFs required; else prompts/errors)
  ▼
loadDocument() × 2               src/lib/pdf.ts
  │  (pdf.js parses each file's bytes into a PDFDocumentProxy)
  ▼
compareDocuments(docA, docB)     src/lib/compare.ts
  │  for each page:
  │    getPositionedWords(page, viewport)   src/lib/pdf.ts
  │    diffPositionedWords(wordsA, wordsB)  src/lib/positioned-diff.ts
  │  pages beyond the shorter doc → "added"/"removed", not dropped
  │  streams a result per page via onPage() and yields between pages
  ▼
CompareResult { pageCount, pages[], totals }
  │
  ▼
main.ts (DOM layer)
  │  renderPageToCanvas() draws the *revised* doc's page at devicePixelRatio
  │  buildOverlayMarks(ops)      src/lib/overlay.ts
  │    → positions green boxes over real inserted words,
  │      groups deletions into a red marker anchored at the edit point
  ▼
Rendered page + diff overlay, page navigator, summary strip
```

## Modules (`src/lib/`)

- **`pdf.ts`** — pdf.js wrapper (legacy build, so it also runs under jsdom
  in tests). `loadDocument`, `getPositionedWords` (viewport-space word
  boxes), `renderPageToCanvas` + `computeCanvasSize` (crisp canvas sizing
  at any devicePixelRatio).
- **`positioned-diff.ts`** — `diffPositionedWords`: the word-level LCS diff
  over positioned tokens that the app runs. Never merges adjacent ops, so a
  changed clause spanning a line break still yields two distinct on-page
  boxes.
- **`overlay.ts`** — `buildOverlayMarks`: turns diff ops into renderable
  marks against the revised page (insertions get their real box; deletions
  are grouped and anchored at the edit point, since removed text has no
  position of its own in the revised layout).
- **`compare.ts`** — `compareDocuments` orchestrates the above per page,
  handles mismatched page counts, and totals additions/deletions.
  `describePageCountDifference` formats the mismatch banner copy.
- **`file-validation.ts`** — `validateDroppedFiles`/`isPdfFile`: exactly
  two PDFs required; a single file prompts for the second, a non-PDF file
  is named in the error.
- **`app-state.ts`** — `appReducer`: a pure state machine (empty →
  loading → ready/error, plus the need-second-file prompt) kept separate
  from DOM code so the workflow is unit-testable without a browser.

## UI (`src/main.ts` + `src/style.css`)

`main.ts` is the only DOM-touching module: it dispatches actions into
`appReducer`, then re-renders the whole `#app` subtree from the resulting
`AppState` on every change (no virtual DOM — the tree is small and
render() is cheap). Drag/drop and the hidden file input both funnel
through `handleFiles()` → `validateDroppedFiles()`.

`renderCurrentPage()` is guarded by a monotonic `renderGeneration` counter:
every call tags itself with the current generation and re-checks it after
each `await` (`getPage`, `renderPageToCanvas`), bailing out if a newer
render has since started. Without this, rapid page-nav clicks (or a resize
firing mid-render) could let a stale, slower render finish last and leave
the canvas/overlay showing the wrong page.

`style.css` implements the tokens and layout in `docs/DESIGN.md`
(Swiss-grid modernist: ivory paper, Fraunces/IBM Plex Mono, redline-red/
ink-green accents). One stylesheet, no CSS framework.

## Testing

Vitest + jsdom. `tests/helpers/pdf-builder.ts` hand-assembles minimal
valid PDFs with text placed at explicit coordinates via the `Tm`
operator, so position-mapping tests assert exact bounding boxes without
committing binary fixture files. `tests/setup.ts` wires pdf.js's worker
module onto `globalThis` so it runs on the main thread under jsdom
(no real Worker/fetchable asset URLs there) — production code still
uses a real Worker in the browser.

`tests/main.test.ts` covers the DOM layer itself (state transitions,
drop/keyboard/drag handling, cancel/reset, the render-generation race
guard) by mocking the `./lib/pdf` and `./lib/compare` boundary — jsdom has
no real canvas 2D context, so `loadDocument`/`renderPageToCanvas`/
`compareDocuments` are replaced with controllable fakes, letting tests
control exactly when each async step resolves (needed to reproduce the
stale-render race). `npm run test:coverage` reports coverage; run it to
see current numbers before assuming a module is untested — `main.ts`'s
own canvas-drawing internals and `pdf.ts`'s `renderPageToCanvas` painting
step are the main gaps left, both real-canvas-only and verified instead
via a real browser (Playwright) rather than jsdom.

## Build

`npm run build` runs `tsc -b && vite build` into `dist/`. `vite.config.ts`
sets `base: "./"` so every asset path is relative — the build is
deployable from any subpath (e.g. `apps.charliekrug.com/draftline/`),
not just a domain root.
