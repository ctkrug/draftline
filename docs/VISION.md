# Draftline — Vision

## The problem

Comparing two versions of a contract, lease, or policy document is a routine but painful task.
The two realistic options today are:

1. **Upload to a SaaS redline tool.** Fast and often good-looking, but it means handing a
   confidential document — an NDA, a lease, a term sheet — to a third-party server. Most of these
   tools also cap free usage at a handful of pages per month and gate the rest behind a
   subscription.
2. **Manual side-by-side reading.** Free and private (open two PDF viewers), but slow and
   error-prone — the human eye is bad at spotting a single changed word in two forty-page
   documents.

There's no free, private, unlimited option that does the comparison _for_ you.

## Who it's for

Anyone who needs to compare two PDF drafts and doesn't want to (or isn't allowed to) upload them
anywhere: a tenant comparing two lease revisions, a small-business owner reviewing a vendor
contract redline from opposing counsel, a freelancer diffing two versions of an SOW. The common
thread is a document that's either sensitive or one-off — not worth an account, and not
something they want sitting on someone else's server.

## The core idea

Draftline runs the entire comparison in the browser:

1. Both PDFs are parsed locally with pdf.js — nothing is uploaded, ever.
2. pdf.js's text layer gives structured text + bounding-box position data for every word on every
   page.
3. A word-level diff (see `src/lib/diff.ts`) compares the two documents' text, isolating exactly
   which words changed rather than flagging whole paragraphs.
4. The original page is rendered as a canvas image (via pdf.js), and the diff result is painted
   as highlighted overlays positioned using the original text's bounding boxes — so the user sees
   the change _in place_, in the document's real layout, not as a plain-text dump.

The wow moment is the instant a user drops two files in and the highlighted diff appears over
the real page image with no upload step and no spinner waiting on a server round-trip.

## Key design decisions

- **No backend, ever.** Static site only. This isn't a v1 shortcut — it's the product's core
  privacy guarantee, and it's what makes "no page cap, no account" possible (there's no server
  cost to ration).
- **Word-level diff, not line-level or character-level.** Legal prose reflows constantly between
  drafts (a renumbered clause, a rewrapped paragraph); line diffing produces noise. Character
  diffing is too granular to read. Word-level (with whitespace/punctuation attached to each
  token) is the right grain for "what clause changed."
- **Overlay on the real page image, not a text-only view.** The value of seeing a redline in its
  original typographic context — column layout, defined terms in bold, section numbering — is
  why this exists instead of just diffing extracted plain text in two `<pre>` blocks.
- **Position via pdf.js text-item bounding boxes.** Each text run pdf.js extracts carries its own
  transform/position; the overlay renderer maps diff spans back to those boxes rather than
  re-flowing text into a synthetic layout.
- **No page cap.** Because there's no server processing cost, there's no reason to artificially
  limit document length. Full contracts and leases (50+ pages) are the expected case, not an
  edge case.

## What "v1 done" looks like

A visitor can, with zero setup:

1. Drop two PDFs onto the page (or pick via file input).
2. See a progress/loading state while both are parsed client-side.
3. Land on a page-by-page view where every page with changes shows red (removed) and green
   (added) highlights directly over the rendered page image, in the original layout.
4. Navigate between pages, with a summary indicating which pages have changes and a rough count
   of additions/deletions.
5. Handle a full-length real-world document (50+ pages) without crashing or becoming unusably
   slow, and handle mismatched page counts / non-text (scanned/image-only) PDFs with a clear
   message instead of a silent failure.

Anything beyond that — export/print of the redline, multi-document history, side-by-side plus
overlay toggle — is a v2 idea, tracked separately, not required to call v1 done.
