---
title: "Building a PDF redline tool that never uploads your files"
published: false
tags: typescript, pdf, webdev, showdev
---

I needed to compare two versions of a lease. The realistic options were to upload a private
document to a website I did not trust, or to open both PDFs side by side and hunt for the one
clause that changed. Neither felt good, so I built [Draftline](https://apps.charliekrug.com/draftline/):
drop in two PDFs and it highlights every added and deleted word right on the revised page, entirely
in the browser. No server, no upload, no page limit.

Here are the two parts that were more interesting than I expected.

## Putting the diff back on the page

The easy version of a PDF diff extracts the text from both files, runs a text diff, and shows the
result in two columns. That works, but it throws away the thing that makes a legal document
readable: the layout. A defined term in bold, a renumbered section, a dollar amount in a table.
I wanted the change marked in its real place on the page.

pdf.js gives you a text layer, but not per word. Each `getTextContent` item is a _run_, which can
be several words, and it carries a transform and a width. So to draw a box around a single changed
word, I split each run on whitespace and distribute the run's width across the words by character
count:

```ts
const uStart = (charOffset / runLength) * runWidth;
const uEnd = ((charOffset + token.length) / runLength) * runWidth;
```

Then I walk each word's corners along the run's baseline and ascent directions and apply the
viewport transform to land in canvas pixels. It is an approximation for proportional fonts, but for
highlight overlays it is close enough that the box sits where your eye expects.

The subtle part was diffing. A reworded clause often spans a line break, and if you merge adjacent
diff ops into one span you get a single box that stretches across two lines and looks wrong. So the
positioned diff keeps one op per word and never merges, so a change across a line break renders as
two correctly placed boxes on the two lines it actually touches. Deletions are the opposite problem:
the removed word has no position in the _revised_ page, so consecutive deletions are grouped into
one marker anchored at the edit point, the right edge of the nearest surviving word.

## The stale render race

Rendering a page is async: `getPage`, then `render` onto a canvas, then position the overlay. If you
click through the page navigator quickly, or the window resizes mid-render, an older render can
finish _after_ a newer one and leave the canvas showing the wrong page under the wrong overlay.

The fix is a monotonic generation token. Every render bumps a counter, captures its value, and
re-checks it after each `await`:

```ts
const generation = ++renderGeneration;
const page = await state.docB.getPage(currentPageNumber);
if (generation !== renderGeneration) return; // a newer render started, bail
```

I reproduced this in a test by mocking the pdf boundary so I could resolve page 2's render _after_
page 3's, then asserting the canvas shows page 3. Races are miserable to test against real timers,
and being able to control exactly when each async step resolves made it straightforward.

Long documents use the same idea for responsiveness: `compareDocuments` yields to the event loop
between pages and honors an `AbortController`, so a sixty-page lease streams in one page at a time
and the Cancel button actually cancels.

## What I would do differently

The width-distribution trick assumes roughly even character widths within a run. For a heavily
proportional font a highlight can be a few pixels off. Real glyph metrics would fix it, at the cost
of a lot more code. I would also add an OCR fallback so scanned PDFs (which have no text layer) get
a diff instead of a polite note.

The whole thing is a static site with no backend, which is the point: your files are read, diffed,
and rendered locally, then gone when you close the tab.

Try it: [apps.charliekrug.com/draftline](https://apps.charliekrug.com/draftline/)
Source: [github.com/ctkrug/draftline](https://github.com/ctkrug/draftline)
