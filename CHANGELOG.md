# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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
  (`src/lib/diff.ts`) and a pdf.js text-extraction wrapper (`src/lib/pdf.ts`).
- CI workflow running typecheck, lint, tests, and build on every push/PR.
- `docs/VISION.md`, `docs/DESIGN.md`, and `docs/BACKLOG.md` planning documents.
