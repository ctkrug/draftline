# Draftline — Backlog

Epics are ordered so the wow moment (Epic 1, Story 1) is reachable first. Every story has
concrete, checkable acceptance criteria — no "works well" vibes. `[ ]` = not started.

---

## Epic 1 — Core compare experience (the wow moment)

The reason this project exists: drop two PDFs in, watch the diff highlight over the real page.

- [ ] **1.1 Drop two PDFs and see the highlighted diff overlay** _(the wow moment — build first)_
  - Dropping two valid PDF files renders page 1 with diff highlights visible, with zero network
    requests for file content (verified via devtools: no XHR/fetch carrying file bytes).
  - Additions render in `--accent-ins` and deletions in `--accent-del`, positioned directly over
    the corresponding text region on the rendered page image (not in a separate text panel).
  - No upload progress spinner, no login/account gate appears anywhere in the flow.

- [ ] **1.2 Client-side PDF parsing and page rendering**
  - `extractPages()` returns per-page text content for a multi-page fixture PDF, matching the
    fixture's known expected text.
  - Each page also renders to a canvas at `devicePixelRatio × CSS size` (crisp on retina,
    recomputes on resize), per the design standard.
  - A 10-page fixture PDF fully parses and renders in under 2 seconds on a typical dev machine.

- [ ] **1.3 Word-level diff mapped to on-page positions**
  - `diffWords()` output (already unit-tested) is extended with a page-level integration test:
    given two page texts, inserted/deleted spans are correctly identified.
  - Each diff span maps to a bounding box (or list of boxes) sourced from the PDF text-item
    positions; a fixture with a known moved word verifies the box lands at the expected
    coordinates.
  - A clause edit that spans a line break maps to two separate boxes on the correct lines, not
    one incorrectly merged box.

- [ ] **1.4 Page navigation and change summary**
  - A page navigator lists every page and visually marks which ones contain changes.
  - Clicking a page marker jumps/scrolls the canvas to that page.
  - A summary strip shows a running count of total additions and deletions, updating as parsing
    completes.

- [ ] **1.5 Design polish — compare view**
  - The compare view matches `docs/DESIGN.md` tokens (Fraunces/IBM Plex Mono, ivory background,
    redline-red/ink-green accents), checked visually at 1440px and 390px.
  - Every interactive control (page navigator items, drop zone) has themed hover, focus-visible,
    and active states per D2 — no naked native widgets.
  - No horizontal scroll or element overlap at 390px width.

---

## Epic 2 — Robustness for real-world documents

Real contracts are messy: different lengths, scanned pages, 50+ pages. The tool has to degrade
gracefully instead of crashing.

- [ ] **2.1 Handle mismatched page counts**
  - Comparing two PDFs with different page counts renders all pages of both documents without
    crashing; extra pages in the longer document are marked "added" (or "removed") rather than
    silently dropped.
  - An explicit banner states the page-count difference (e.g. "Document B has 3 more pages than
    Document A").

- [ ] **2.2 Handle non-text / scanned PDFs**
  - A fixture PDF with an empty or near-empty text layer (scanned image, no text run) shows a
    clear inline message ("no extractable text found on this page") instead of a blank canvas.
  - No uncaught exception in the console when processing such a file.

- [ ] **2.3 Handle large documents without freezing the UI**
  - A 50+ page fixture PDF parses without blocking the main thread for more than ~150ms per
    page (work is chunked/yielded); a cancel control stays clickable throughout processing.
  - Pages render progressively — page 1 is visible before page 50 finishes processing, not
    all-or-nothing.

- [ ] **2.4 File validation and input error states**
  - Selecting a non-PDF file shows an inline error naming the file and the reason, with no
    crash.
  - Dropping only one file prompts the user to add the second file rather than throwing an
    error.

- [ ] **2.5 Design polish — empty, loading, and error states**
  - Empty, loading, and error states each have a distinct designed treatment per D2 (not a
    blank screen or a browser `alert()`), matching `docs/DESIGN.md`.
  - The loading state uses the signature rule-draw animation from `docs/DESIGN.md` (or its
    `prefers-reduced-motion` fallback), not a generic spinner.

---

## Epic 3 — Landing, brand, and shippability

The static site IS the product — no separate marketing page. This epic makes the empty state
double as a trustworthy landing experience and makes the build genuinely deployable.

- [ ] **3.1 Empty state explains the privacy model**
  - The empty (pre-drop) state states in one sentence that files never leave the browser —
    the core trust proposition — visible without scrolling at both 1440px and 390px.
  - A short line describes the tool's scope (contract/lease redlines) so visitors self-select
    correctly.

- [ ] **3.2 Favicon and wordmark**
  - The favicon is a generated inline SVG (data URI or built asset) using `--accent-del` and a
    monogram/glyph, present in `index.html`'s `<head>` — not the framework default icon.
  - The wordmark renders the struck-rule motif described in `docs/DESIGN.md`'s signature detail.

- [ ] **3.3 Responsive layout across breakpoints**
  - At 390px, 768px, and 1440px the layout matches `docs/DESIGN.md`'s layout intent: no dead
    empty space, no horizontal scroll, and the left rail collapses to a bottom strip on phone.
  - Touch targets in the mobile page-navigator strip are ≥44px.

- [ ] **3.4 Static build deployable to a subpath**
  - `npm run build` produces a single `dist/` directory using only relative asset paths — no
    `href="/..."` or `src="/..."` absolute-root references anywhere in the built output.
  - Serving `dist/` from a non-root subpath (e.g. `vite preview --base /draftline/`) loads with
    no broken asset requests.

- [ ] **3.5 Design polish — whole-page cohesion**
  - The empty state and the loaded compare view read as one consistent brand (squint test)
    against `docs/DESIGN.md` — verified manually and noted in the QA STATUS `memory` field.
  - Text/background pairs from the token set meet ≥4.5:1 contrast.
