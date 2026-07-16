# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.0] - 2026-07-16

### Changed

- The page-count mismatch banner now says "the revised document" / "the
  original document" instead of "Document A" / "Document B", matching the
  file labels shown in the rail.
- `npm run build` now outputs to `site/` (the published directory) rather
  than `dist/`.

### Removed

- The unused plain-text diff engine (`src/lib/diff.ts`) and the unused
  `extractPages` text extractor. The app diffs positioned words through
  `diffPositionedWords`, which is now the single diff path.

### Added

- Landing/SEO copy and a five-question FAQ below the tool, plus a footer
  linking the source and the wider portfolio, and page metadata (title,
  description, OG tags).

### Fixed

- A rapid page-nav click (or a resize firing mid-render) could let a slower,
  stale render finish last, leaving the canvas and diff overlay showing the
  wrong page — guarded with a render-generation token.
- Dropping more than two PDFs silently compared the first two and discarded
  the rest with no indication which files were used; now reported as an error.
- Pressing Enter/Space on the dropzone, or clicking it directly, opened the
  file picker twice (`input.click()`'s own bubbling click event re-entered the
  dropzone's click listener).
- Screen readers had no way to tell what changed on the page they were
  viewing — the diff overlay is `aria-hidden`, and the per-page caption was
  blank whenever there was nothing else to say. It's now a live region with a
  real per-page summary ("2 additions and 1 deletion on this page").
- The "changed" page-nav indicator was CSS-generated content that some screen
  readers fold into the accessible name in a confusing form; changed pages now
  get a plain-language `aria-label` instead.

### Added

- The core compare experience: drop two PDFs and see word-level diff highlights
  painted directly over the revised document's rendered pages — insertions in
  place, deletions as a strikethrough marker at the edit point.
- Position-aware text extraction (`getPositionedWords`) and a positioned-word
  diff (`diffPositionedWords`) that keeps each changed word's own bounding box,
  so an edit spanning a line break renders as two correctly placed highlights.
- Per-page canvas rendering at `devicePixelRatio`, recomputed on resize.
- A page navigator marking which pages changed, and a running additions/
  deletions summary in the top bar.
- Graceful handling of mismatched page counts (added/removed page banners),
  scanned/image-only pages, and long documents (streamed, yielded page-by-page
  processing with a cancel control).
- PDF file-drop validation with designed empty, loading, error, and
  need-second-file states, matching `docs/DESIGN.md`'s Swiss-grid direction.
- A generated favicon and a struck-rule wordmark motif.
- `docs/ARCHITECTURE.md` mapping the codebase's data flow and modules.
- Project scaffold: TypeScript + Vite + pdf.js, with a word-level LCS diff engine
  (`src/lib/positioned-diff.ts`) and a pdf.js text-extraction wrapper (`src/lib/pdf.ts`).
- CI workflow running typecheck, lint, tests, and build on every push/PR.
- `docs/VISION.md`, `docs/DESIGN.md`, and `docs/BACKLOG.md` planning documents.
