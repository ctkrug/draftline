# Draftline — Design

## 1. Aesthetic direction

**Swiss-grid modernist.** Draftline is a precision instrument for reading structured documents,
so the interface should read like a well-typeset legal form or a Swiss information-design
poster: a strict grid, restrained type, generous whitespace, and functional color used
sparingly and meaningfully — not decoratively. The one indulgence is the redline itself: a
confident editorial red for deletions and a cool ink green for additions, exactly the marks a
careful reader would make with two different pens. Everything else stays quiet so those marks
read as *the* signal on the page.

One sentence: *Draftline looks like a Swiss type foundry's specimen sheet that happens to also
be a redlining tool — a strict grid, quiet ivory paper, and two confident editorial marks: red
for cut, green for added.*

This direction hasn't been used in recent ships (recent sibling projects lean manuscript-paper,
blueprint-schematic, or forensic-case-file — this is grid-and-type-first, not texture-first).

## 2. Tokens

| Token | Value | Use |
|---|---|---|
| `--bg` | `#f4f2ec` | page background — warm off-white, not stark white |
| `--surface-1` | `#ffffff` | cards, the page-image canvas mount |
| `--surface-2` | `#e8e5dc` | recessed panels (sidebar, drop zone idle state) |
| `--ink` | `#17171a` | primary text — near-black, not pure #000 |
| `--ink-muted` | `#5c5b54` | secondary text, captions, metadata |
| `--rule` | `#c9c6b8` | grid lines, dividers, borders |
| `--accent-del` | `#c0242c` | deletions — redline red |
| `--accent-ins` | `#1f7a4d` | additions — ink green |
| `--accent-focus` | `#1d4ed8` | focus rings, links, primary interactive accent (cool blue reads as "system," distinct from the red/green diff marks) |
| `--danger` | `#c0242c` | error states (shares the deletion red — errors and deletions are both "something's wrong here") |
| `--success` | `#1f7a4d` | success states (shares the addition green) |

**Type pairing:** display font **"Fraunces"** (a high-contrast serif with real personality for
the wordmark and headings — ties to the document/editorial subject matter without being a
default web-safe serif), UI font **"IBM Plex Mono"** for everything else (labels, buttons, page
numbers, metadata) — a grid-and-form aesthetic wants a monospace workhorse, and it doubles as a
nod to the "document engineering" nature of the tool. Both load from Google Fonts with system
fallbacks (`Georgia, serif` / `"SF Mono", Consolas, monospace`).

**Spacing:** 8px base unit (`4px` half-step allowed for tight in-control spacing). Scale: 4, 8,
12, 16, 24, 32, 48, 64, 96.

**Corner radius:** `2px` on interactive controls only (buttons, inputs) — sharp enough to feel
like a drafted form, not a soft app. Page-image containers and panels are `0px` (true to grid).

**Shadow:** no soft glows. A single hairline `1px solid var(--rule)` border plus, on raised
elements (the drop zone on hover, modals), a hard offset shadow: `4px 4px 0 var(--ink)` at low
opacity (`0.08`) — a drafting-table "paper lifted off the table" cue, not a blur.

**Motion:** UI transitions 150ms ease-out. Diff highlights fade in over 200ms when a page
finishes rendering (so the eye can track what just appeared rather than a jarring pop). No
bouncy easing anywhere — the whole point of this direction is restraint.

## 3. Layout intent

The hero is **the page-image comparison itself** — the rendered PDF page with diff overlays.
On desktop (1440×900): a fixed-width left rail (~280px) holds the drop zone / file info / page
navigator / change summary; the remaining ~1160px is the page canvas, centered, filling the
vertical space (≥70vh). A thin top bar (56px) carries the wordmark and a compact stats strip
(pages changed / additions / deletions). No hero marketing copy competing for space once a
document is loaded — the empty state is the only place prose appears.

On phone (390×844): the left rail collapses into a bottom sheet / top-collapsible panel (page
navigator becomes a horizontal swipe strip of page-change dots), and the page canvas takes the
full width and the majority of vertical space, pinch-zoomable.

**Empty state** (before any files are dropped) is a full-viewport centered drop zone on the
grid — a large dashed-rule rectangle sized to ~60vh, with the wordmark above it and a one-line
instruction below, so the page never reads as "unfinished" before a document loads.

## 4. Signature detail

The **wordmark** is set in Fraunces with the "line" in "Draftline" rendered as an actual drawn
horizontal rule struck through the baseline in `--accent-del`, like a single redline mark
through one word — the product's function, visible in its own logo. This same struck-rule motif
reappears as the loading indicator (a red rule that draws itself left-to-right while a page
renders) instead of a generic spinner.

## 5. Juice plan

Draftline is a utility, not a game, so "juice" here means *responsive, legible feedback*, not
particle effects:

- Dropping a file: the drop zone border animates from dashed `--rule` to solid `--accent-focus`
  over 150ms on drag-over, and briefly flashes `--surface-2` on drop.
- Page render: each page's diff overlay fades in (200ms) as it finishes computing, so a
  multi-page document visibly "fills in" left to right / top to bottom rather than popping in
  all at once.
- Page navigation: switching pages does a fast 120ms crossfade, no slide (sliding would fight
  the "reading a document" mental model).
- No sound design — this is a professional document tool, not a toy; a WebAudio SFX layer would
  work against the direction. (No mute toggle needed as a result.)
- Respect `prefers-reduced-motion`: fades collapse to instant swaps; the wordmark's rule-draw
  animation becomes a static struck line.
