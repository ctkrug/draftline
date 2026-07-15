import { afterEach, describe, expect, it, vi } from "vitest";
import type { PositionedDiffOp } from "../src/lib/positioned-diff";
import type { PositionedWord } from "../src/lib/pdf";
import type { CompareResult } from "../src/lib/compare";

// main.ts is the DOM layer: it wires drag/drop + file input to the pure
// appReducer/compareDocuments/getPositionedWords logic (all covered by their
// own unit tests elsewhere). Here we mock the pdf.js/canvas boundary
// (./lib/pdf's loadDocument/renderPageToCanvas and ./lib/compare's
// compareDocuments) so the DOM orchestration itself — state transitions,
// drop/cancel/reset handling, and render sequencing — is testable under
// jsdom without a real canvas 2D context or PDF bytes.
vi.mock("../src/lib/pdf", () => ({
  loadDocument: vi.fn(),
  renderPageToCanvas: vi.fn(),
}));
vi.mock("../src/lib/compare", () => ({
  compareDocuments: vi.fn(),
  describePageCountDifference: vi.fn(() => null),
}));

function pdfFile(name: string): File {
  return new File(["%PDF-1.4"], name, { type: "application/pdf" });
}

function word(text: string): PositionedWord {
  return { text, x: 0, y: 0, width: 10, height: 12 };
}

function dispatchDrop(target: Element, files: File[]): void {
  const event = new Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", { value: { files } });
  target.dispatchEvent(event);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => (resolve = res));
  return { promise, resolve };
}

async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

// Each mountApp() imports a fresh main.ts module instance, which registers
// its own `window.addEventListener("resize", ...)` closing over that
// instance's own state/root. Nothing ever removes the previous instance's
// listener, so without cleanup every earlier test's stale listener keeps
// firing (against a torn-down #app and a since-reset mock) on every later
// resize dispatch. Track and remove it before mounting the next instance.
let lastResizeHandler: EventListenerOrEventListenerObject | null = null;

/** Fresh module graph per test: resetModules + re-import both the mocked
 * boundary modules (so we hold the same mock instances main.ts imports)
 * and main.ts itself, against a brand-new #app root. */
async function mountApp() {
  if (lastResizeHandler) {
    window.removeEventListener("resize", lastResizeHandler);
    lastResizeHandler = null;
  }

  document.body.innerHTML = '<div id="app"></div>';
  vi.resetModules();
  const pdfMock = await import("../src/lib/pdf");
  const compareMock = await import("../src/lib/compare");
  // vi.mock's factory only runs once, so its vi.fn() instances (and their
  // call history/implementations) persist across vi.resetModules() calls —
  // reset them explicitly so each mounted app starts from a clean slate.
  vi.mocked(pdfMock.loadDocument).mockReset();
  vi.mocked(pdfMock.renderPageToCanvas).mockReset();
  vi.mocked(compareMock.compareDocuments).mockReset();
  vi.mocked(compareMock.describePageCountDifference).mockReset().mockReturnValue(null);

  const addSpy = vi.spyOn(window, "addEventListener");
  await import("../src/main");
  const resizeCall = addSpy.mock.calls.find(([type]) => type === "resize");
  lastResizeHandler = resizeCall ? (resizeCall[1] as EventListenerOrEventListenerObject) : null;
  addSpy.mockRestore();

  return { pdfMock, compareMock };
}

function fakeDoc(numPages: number, pageTag: string) {
  return {
    numPages,
    getPage: vi.fn((n: number) => Promise.resolve({ __tag: pageTag, __pageNumber: n })),
  };
}

describe("main.ts DOM layer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the empty state with a dropzone on load", async () => {
    await mountApp();

    expect(document.querySelector(".empty-shell")).not.toBeNull();
    expect(document.querySelector(".dropzone")).not.toBeNull();
    expect(document.querySelector(".wordmark")).not.toBeNull();
  });

  it("prompts for a second file when only one PDF is dropped", async () => {
    await mountApp();

    const dropzone = document.querySelector(".dropzone");
    if (!dropzone) throw new Error("dropzone missing");
    dispatchDrop(dropzone, [pdfFile("original.pdf")]);

    const banner = document.querySelector(".banner--info");
    expect(banner?.textContent).toContain("original.pdf");
    expect(document.querySelector(".dropzone")).not.toBeNull();
  });

  it("shows a named error banner for a non-PDF file dropped as the second file", async () => {
    await mountApp();

    const dropzone = document.querySelector(".dropzone");
    if (!dropzone) throw new Error("dropzone missing");
    dispatchDrop(dropzone, [pdfFile("original.pdf")]);
    dispatchDrop(document.querySelector(".dropzone")!, [
      new File(["hi"], "notes.txt", { type: "text/plain" }),
    ]);

    const banner = document.querySelector(".banner--error");
    expect(banner?.textContent).toContain("notes.txt");
  });

  it("shows an error, not a silent 2-of-3 comparison, when three PDFs are dropped", async () => {
    await mountApp();

    dispatchDrop(document.querySelector(".dropzone")!, [
      pdfFile("a.pdf"),
      pdfFile("b.pdf"),
      pdfFile("c.pdf"),
    ]);

    expect(document.querySelector(".banner--error")?.textContent).toContain("3 were dropped");
  });

  it("recovers from the error state when a valid pair is dropped next", async () => {
    const { pdfMock, compareMock } = await mountApp();

    dispatchDrop(document.querySelector(".dropzone")!, [
      new File(["hi"], "notes.txt", { type: "text/plain" }),
    ]);
    expect(document.querySelector(".banner--error")).not.toBeNull();

    vi.mocked(pdfMock.loadDocument).mockResolvedValue(fakeDoc(1, "A") as never);
    vi.mocked(pdfMock.renderPageToCanvas).mockResolvedValue({
      scale: 1,
      width: 100,
      height: 100,
    } as never);
    vi.mocked(compareMock.compareDocuments).mockResolvedValue({
      pageCount: { a: 1, b: 1 },
      pages: [
        {
          status: "compared",
          pageNumber: 1,
          ops: [],
          additions: 0,
          deletions: 0,
          hasChanges: false,
        },
      ],
      totals: { additions: 0, deletions: 0, pagesChanged: 0 },
    });

    dispatchDrop(document.querySelector(".dropzone")!, [
      pdfFile("original.pdf"),
      pdfFile("revised.pdf"),
    ]);
    await flush();

    expect(document.querySelector(".app-shell")).not.toBeNull();
    expect(document.querySelector(".banner--error")).toBeNull();
  });

  it("loads and compares two valid PDFs, rendering the ready shell", async () => {
    const { pdfMock, compareMock } = await mountApp();

    const docA = fakeDoc(1, "A");
    const docB = fakeDoc(1, "B");
    vi.mocked(pdfMock.loadDocument).mockResolvedValueOnce(docA as never);
    vi.mocked(pdfMock.loadDocument).mockResolvedValueOnce(docB as never);
    vi.mocked(pdfMock.renderPageToCanvas).mockResolvedValue({
      scale: 1,
      width: 100,
      height: 100,
    } as never);

    const ops: PositionedDiffOp[] = [{ type: "insert", word: word("added") }];
    const result: CompareResult = {
      pageCount: { a: 1, b: 1 },
      pages: [
        { status: "compared", pageNumber: 1, ops, additions: 1, deletions: 0, hasChanges: true },
      ],
      totals: { additions: 1, deletions: 0, pagesChanged: 1 },
    };
    vi.mocked(compareMock.compareDocuments).mockResolvedValue(result);

    const dropzone = document.querySelector(".dropzone");
    if (!dropzone) throw new Error("dropzone missing");
    dispatchDrop(dropzone, [pdfFile("original.pdf"), pdfFile("revised.pdf")]);

    expect(document.querySelector(".loading")).not.toBeNull();

    await flush();

    expect(document.querySelector(".app-shell")).not.toBeNull();
    expect(document.querySelector(".stats")?.textContent).toContain("+1");
    expect(document.querySelectorAll(".page-nav-item")).toHaveLength(1);

    const caption = document.querySelector(".stage-caption");
    expect(caption?.getAttribute("aria-live")).toBe("polite");
    expect(caption?.textContent).toBe("1 addition on this page.");
  });

  it("announces 'no changes' on a compared page with an empty diff", async () => {
    const { pdfMock, compareMock } = await mountApp();

    vi.mocked(pdfMock.loadDocument).mockResolvedValue(fakeDoc(1, "A") as never);
    vi.mocked(pdfMock.renderPageToCanvas).mockResolvedValue({
      scale: 1,
      width: 100,
      height: 100,
    } as never);
    const ops: PositionedDiffOp[] = [{ type: "equal", wordA: word("same"), wordB: word("same") }];
    vi.mocked(compareMock.compareDocuments).mockResolvedValue({
      pageCount: { a: 1, b: 1 },
      pages: [
        { status: "compared", pageNumber: 1, ops, additions: 0, deletions: 0, hasChanges: false },
      ],
      totals: { additions: 0, deletions: 0, pagesChanged: 0 },
    });

    dispatchDrop(document.querySelector(".dropzone")!, [
      pdfFile("original.pdf"),
      pdfFile("revised.pdf"),
    ]);
    await flush();

    expect(document.querySelector(".stage-caption")?.textContent).toBe("No changes on this page.");
  });

  it("cancelling mid-compare returns to the empty state", async () => {
    const { pdfMock, compareMock } = await mountApp();

    vi.mocked(pdfMock.loadDocument).mockResolvedValue(fakeDoc(1, "A") as never);
    const pending = deferred<CompareResult>();
    vi.mocked(compareMock.compareDocuments).mockImplementation((_a, _b, _onPage, signal) => {
      return pending.promise.then((value) => {
        signal?.throwIfAborted();
        return value;
      });
    });

    const dropzone = document.querySelector(".dropzone");
    if (!dropzone) throw new Error("dropzone missing");
    dispatchDrop(dropzone, [pdfFile("original.pdf"), pdfFile("revised.pdf")]);
    await flush();

    const cancelButton = document.querySelector<HTMLButtonElement>(".cancel-btn");
    expect(cancelButton).not.toBeNull();
    cancelButton?.click();

    pending.resolve({
      pageCount: { a: 1, b: 1 },
      pages: [],
      totals: { additions: 0, deletions: 0, pagesChanged: 0 },
    });
    await flush();

    expect(document.querySelector(".empty-shell")).not.toBeNull();
    expect(document.querySelector(".banner--error")).toBeNull();
  });

  it("resets to the empty state via the new-comparison button", async () => {
    const { pdfMock, compareMock } = await mountApp();

    vi.mocked(pdfMock.loadDocument).mockResolvedValue(fakeDoc(1, "A") as never);
    vi.mocked(pdfMock.renderPageToCanvas).mockResolvedValue({
      scale: 1,
      width: 100,
      height: 100,
    } as never);
    vi.mocked(compareMock.compareDocuments).mockResolvedValue({
      pageCount: { a: 1, b: 1 },
      pages: [
        {
          status: "compared",
          pageNumber: 1,
          ops: [],
          additions: 0,
          deletions: 0,
          hasChanges: false,
        },
      ],
      totals: { additions: 0, deletions: 0, pagesChanged: 0 },
    });

    dispatchDrop(document.querySelector(".dropzone")!, [
      pdfFile("original.pdf"),
      pdfFile("revised.pdf"),
    ]);
    await flush();
    expect(document.querySelector(".app-shell")).not.toBeNull();

    document.querySelector<HTMLButtonElement>(".new-compare-btn")?.click();

    expect(document.querySelector(".empty-shell")).not.toBeNull();
    expect(document.querySelector(".dropzone")).not.toBeNull();
  });

  it("resolves to the last-clicked page when a stale page-nav render finishes after a newer one", async () => {
    const { pdfMock, compareMock } = await mountApp();

    vi.mocked(pdfMock.loadDocument).mockResolvedValue(fakeDoc(2, "doc") as never);

    const page2Ops: PositionedDiffOp[] = [{ type: "insert", word: word("page-two-mark") }];
    const page3Ops: PositionedDiffOp[] = [{ type: "insert", word: word("page-three-mark") }];
    vi.mocked(compareMock.compareDocuments).mockResolvedValue({
      pageCount: { a: 3, b: 3 },
      pages: [
        {
          status: "compared",
          pageNumber: 1,
          ops: [],
          additions: 0,
          deletions: 0,
          hasChanges: false,
        },
        {
          status: "compared",
          pageNumber: 2,
          ops: page2Ops,
          additions: 1,
          deletions: 0,
          hasChanges: true,
        },
        {
          status: "compared",
          pageNumber: 3,
          ops: page3Ops,
          additions: 1,
          deletions: 0,
          hasChanges: true,
        },
      ],
      totals: { additions: 2, deletions: 0, pagesChanged: 2 },
    });

    const renderDeferreds: Array<
      ReturnType<typeof deferred<{ scale: number; width: number; height: number }>>
    > = [];
    vi.mocked(pdfMock.renderPageToCanvas).mockImplementation(() => {
      const next = deferred<{ scale: number; width: number; height: number }>();
      renderDeferreds.push(next);
      return next.promise as never;
    });

    dispatchDrop(document.querySelector(".dropzone")!, [
      pdfFile("original.pdf"),
      pdfFile("revised.pdf"),
    ]);
    await flush();
    // The initial render of page 1 (empty page, no ops) consumes the first
    // renderPageToCanvas call; resolve it so it doesn't linger.
    renderDeferreds[0]?.resolve({ scale: 1, width: 100, height: 100 });
    await flush();

    const [, page2Button, page3Button] =
      document.querySelectorAll<HTMLButtonElement>(".page-nav-item");

    page2Button.click();
    await flush();
    page3Button.click();
    await flush();

    // Two renders are now in flight: page 2's (started first) and page 3's
    // (started second, so it holds the current generation). Resolve page 3's
    // render before page 2's, simulating page 3's render winning the race.
    const page3Render = renderDeferreds[renderDeferreds.length - 1];
    const page2Render = renderDeferreds[renderDeferreds.length - 2];
    page3Render.resolve({ scale: 1, width: 100, height: 100 });
    await flush();
    page2Render.resolve({ scale: 1, width: 100, height: 100 });
    await flush();

    const marks = document.querySelectorAll(".overlay-layer .mark");
    expect(marks).toHaveLength(1);
    expect(document.querySelector(".page-nav-item--active")?.textContent).toBe("Page 3");
  });

  it("opens the file picker on Enter and on Space, not on other keys", async () => {
    await mountApp();

    const dropzone = document.querySelector<HTMLElement>(".dropzone");
    const input = document.querySelector<HTMLInputElement>(".dropzone input");
    if (!dropzone || !input) throw new Error("dropzone/input missing");
    const clickSpy = vi.spyOn(input, "click");

    dropzone.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    expect(clickSpy).not.toHaveBeenCalled();

    dropzone.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(clickSpy).toHaveBeenCalledTimes(1);

    dropzone.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    expect(clickSpy).toHaveBeenCalledTimes(2);
  });

  it("opens the file picker on a direct mouse click on the dropzone", async () => {
    await mountApp();

    const dropzone = document.querySelector<HTMLElement>(".dropzone");
    const label = document.querySelector<HTMLElement>(".dropzone-label");
    const input = document.querySelector<HTMLInputElement>(".dropzone input");
    if (!dropzone || !label || !input) throw new Error("dropzone/label/input missing");
    const clickSpy = vi.spyOn(input, "click");

    // A real user click lands on the label (the input is hidden), then
    // bubbles to the dropzone's own listener — not on the input itself.
    label.dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("adds a dragover style while a file is dragged over the dropzone", async () => {
    await mountApp();

    const dropzone = document.querySelector<HTMLElement>(".dropzone");
    if (!dropzone) throw new Error("dropzone missing");

    dropzone.dispatchEvent(new Event("dragover", { bubbles: true, cancelable: true }));
    expect(dropzone.classList.contains("dropzone--dragover")).toBe(true);

    dropzone.dispatchEvent(new Event("dragleave", { bubbles: true }));
    expect(dropzone.classList.contains("dropzone--dragover")).toBe(false);
  });

  it("handles files chosen via the hidden file input, same as a drop", async () => {
    await mountApp();

    const input = document.querySelector<HTMLInputElement>(".dropzone input");
    if (!input) throw new Error("file input missing");

    Object.defineProperty(input, "files", { value: [pdfFile("chosen.pdf")], configurable: true });
    input.dispatchEvent(new Event("change", { bubbles: true }));

    const banner = document.querySelector(".banner--info");
    expect(banner?.textContent).toContain("chosen.pdf");
  });

  it("shows the page-count-mismatch banner when the two documents differ in length", async () => {
    const { pdfMock, compareMock } = await mountApp();

    vi.mocked(pdfMock.loadDocument).mockResolvedValue(fakeDoc(1, "A") as never);
    vi.mocked(pdfMock.renderPageToCanvas).mockResolvedValue({
      scale: 1,
      width: 100,
      height: 100,
    } as never);
    vi.mocked(compareMock.compareDocuments).mockResolvedValue({
      pageCount: { a: 1, b: 2 },
      pages: [
        {
          status: "compared",
          pageNumber: 1,
          ops: [],
          additions: 0,
          deletions: 0,
          hasChanges: false,
        },
        { status: "added", pageNumber: 2 },
      ],
      totals: { additions: 0, deletions: 0, pagesChanged: 1 },
    });
    vi.mocked(compareMock.describePageCountDifference).mockReturnValue(
      "Document B has 1 more page than Document A",
    );

    dispatchDrop(document.querySelector(".dropzone")!, [
      pdfFile("original.pdf"),
      pdfFile("revised.pdf"),
    ]);
    await flush();

    expect(document.querySelector(".banner--compact")?.textContent).toBe(
      "Document B has 1 more page than Document A",
    );
    const navButtons = document.querySelectorAll<HTMLButtonElement>(".page-nav-item");
    expect(navButtons[1]?.textContent).toBe("Page 2 — added");
    expect(navButtons[1]?.getAttribute("aria-label")).toBe("Page 2 — added — has changes");
    // An unchanged page gets no aria-label override — its accessible name
    // is just its plain text content, with no decorative-dot confusion.
    expect(navButtons[0]?.getAttribute("aria-label")).toBeNull();

    navButtons[1]?.click();
    await flush();

    expect(document.querySelector(".stage-caption")?.textContent).toBe(
      "This page was added in the revised document.",
    );
    expect(
      document.querySelector(".overlay-layer")?.classList.contains("overlay-layer--added"),
    ).toBe(true);
  });

  it("renders the removed-page state when navigating to a page dropped from the revised document", async () => {
    const { pdfMock, compareMock } = await mountApp();

    vi.mocked(pdfMock.loadDocument).mockResolvedValue(fakeDoc(2, "A") as never);
    vi.mocked(pdfMock.renderPageToCanvas).mockResolvedValue({
      scale: 1,
      width: 100,
      height: 100,
    } as never);
    vi.mocked(compareMock.compareDocuments).mockResolvedValue({
      pageCount: { a: 2, b: 1 },
      pages: [
        {
          status: "compared",
          pageNumber: 1,
          ops: [],
          additions: 0,
          deletions: 0,
          hasChanges: false,
        },
        { status: "removed", pageNumber: 2 },
      ],
      totals: { additions: 0, deletions: 0, pagesChanged: 1 },
    });

    dispatchDrop(document.querySelector(".dropzone")!, [
      pdfFile("original.pdf"),
      pdfFile("revised.pdf"),
    ]);
    await flush();

    document.querySelectorAll<HTMLButtonElement>(".page-nav-item")[1]?.click();
    await flush();

    expect(document.querySelector(".stage-caption")?.textContent).toBe(
      "This page was removed from the revised document.",
    );
    expect(
      document.querySelector(".overlay-layer")?.classList.contains("overlay-layer--removed"),
    ).toBe(true);
  });

  it("renders a grouped delete mark alongside insert marks on a compared page", async () => {
    const { pdfMock, compareMock } = await mountApp();

    vi.mocked(pdfMock.loadDocument).mockResolvedValue(fakeDoc(1, "A") as never);
    vi.mocked(pdfMock.renderPageToCanvas).mockResolvedValue({
      scale: 1,
      width: 100,
      height: 100,
    } as never);
    const ops: PositionedDiffOp[] = [{ type: "delete", word: word("removed-clause") }];
    vi.mocked(compareMock.compareDocuments).mockResolvedValue({
      pageCount: { a: 1, b: 1 },
      pages: [
        { status: "compared", pageNumber: 1, ops, additions: 0, deletions: 1, hasChanges: true },
      ],
      totals: { additions: 0, deletions: 1, pagesChanged: 1 },
    });

    dispatchDrop(document.querySelector(".dropzone")!, [
      pdfFile("original.pdf"),
      pdfFile("revised.pdf"),
    ]);
    await flush();

    const deleteMark = document.querySelector(".mark--delete");
    expect(deleteMark?.textContent).toBe("− removed-clause");
  });

  it("pluralizes the per-page summary for more than one addition or deletion", async () => {
    const { pdfMock, compareMock } = await mountApp();

    vi.mocked(pdfMock.loadDocument).mockResolvedValue(fakeDoc(1, "A") as never);
    vi.mocked(pdfMock.renderPageToCanvas).mockResolvedValue({
      scale: 1,
      width: 100,
      height: 100,
    } as never);
    const ops: PositionedDiffOp[] = [
      { type: "insert", word: word("first") },
      { type: "insert", word: word("second") },
      { type: "delete", word: word("third") },
      { type: "delete", word: word("fourth") },
    ];
    vi.mocked(compareMock.compareDocuments).mockResolvedValue({
      pageCount: { a: 1, b: 1 },
      pages: [
        { status: "compared", pageNumber: 1, ops, additions: 2, deletions: 2, hasChanges: true },
      ],
      totals: { additions: 2, deletions: 2, pagesChanged: 1 },
    });

    dispatchDrop(document.querySelector(".dropzone")!, [
      pdfFile("original.pdf"),
      pdfFile("revised.pdf"),
    ]);
    await flush();

    expect(document.querySelector(".stage-caption")?.textContent).toBe(
      "2 additions and 2 deletions on this page.",
    );
  });

  it("re-renders the current page on window resize while a comparison is ready", async () => {
    const { pdfMock, compareMock } = await mountApp();

    vi.mocked(pdfMock.loadDocument).mockResolvedValue(fakeDoc(1, "A") as never);
    vi.mocked(pdfMock.renderPageToCanvas).mockResolvedValue({
      scale: 1,
      width: 100,
      height: 100,
    } as never);
    vi.mocked(compareMock.compareDocuments).mockResolvedValue({
      pageCount: { a: 1, b: 1 },
      pages: [
        {
          status: "compared",
          pageNumber: 1,
          ops: [],
          additions: 0,
          deletions: 0,
          hasChanges: false,
        },
      ],
      totals: { additions: 0, deletions: 0, pagesChanged: 0 },
    });

    dispatchDrop(document.querySelector(".dropzone")!, [
      pdfFile("original.pdf"),
      pdfFile("revised.pdf"),
    ]);
    await flush();

    const callsBefore = vi.mocked(pdfMock.renderPageToCanvas).mock.calls.length;
    window.dispatchEvent(new Event("resize"));
    await flush();

    expect(vi.mocked(pdfMock.renderPageToCanvas).mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it("does not re-render on resize while not in the ready phase", async () => {
    const { pdfMock } = await mountApp();

    window.dispatchEvent(new Event("resize"));
    await flush();

    expect(vi.mocked(pdfMock.renderPageToCanvas)).not.toHaveBeenCalled();
  });

  it("shows a readable error banner when loading a PDF fails", async () => {
    const { pdfMock } = await mountApp();

    vi.mocked(pdfMock.loadDocument).mockRejectedValue(new Error("Invalid PDF structure"));

    dispatchDrop(document.querySelector(".dropzone")!, [
      pdfFile("original.pdf"),
      pdfFile("revised.pdf"),
    ]);
    await flush();

    expect(document.querySelector(".banner--error")?.textContent).toBe("Invalid PDF structure");
    expect(document.querySelector(".dropzone")).not.toBeNull();
  });

  it("falls back to a generic message when a load failure isn't an Error instance", async () => {
    const { pdfMock } = await mountApp();

    vi.mocked(pdfMock.loadDocument).mockRejectedValue("not an Error object");

    dispatchDrop(document.querySelector(".dropzone")!, [
      pdfFile("original.pdf"),
      pdfFile("revised.pdf"),
    ]);
    await flush();

    expect(document.querySelector(".banner--error")?.textContent).toBe(
      "Could not read one of the PDF files.",
    );
  });

  it("shows an error banner when compareDocuments itself fails, not just document loading", async () => {
    const { pdfMock, compareMock } = await mountApp();

    vi.mocked(pdfMock.loadDocument).mockResolvedValue(fakeDoc(1, "A") as never);
    vi.mocked(compareMock.compareDocuments).mockRejectedValue(new Error("Corrupt content stream"));

    dispatchDrop(document.querySelector(".dropzone")!, [
      pdfFile("original.pdf"),
      pdfFile("revised.pdf"),
    ]);
    await flush();

    expect(document.querySelector(".banner--error")?.textContent).toBe("Corrupt content stream");
  });

  it("resetting while a page render is still in flight doesn't resurrect the ready shell", async () => {
    const { pdfMock, compareMock } = await mountApp();

    vi.mocked(pdfMock.loadDocument).mockResolvedValue(fakeDoc(1, "A") as never);
    const renderPending = deferred<{ scale: number; width: number; height: number }>();
    vi.mocked(pdfMock.renderPageToCanvas).mockReturnValue(renderPending.promise as never);
    vi.mocked(compareMock.compareDocuments).mockResolvedValue({
      pageCount: { a: 1, b: 1 },
      pages: [
        {
          status: "compared",
          pageNumber: 1,
          ops: [],
          additions: 0,
          deletions: 0,
          hasChanges: false,
        },
      ],
      totals: { additions: 0, deletions: 0, pagesChanged: 0 },
    });

    dispatchDrop(document.querySelector(".dropzone")!, [
      pdfFile("original.pdf"),
      pdfFile("revised.pdf"),
    ]);
    await flush();
    expect(document.querySelector(".app-shell")).not.toBeNull();

    // The initial page render is still awaiting renderPageToCanvas here.
    // Reset back to empty before it resolves.
    document.querySelector<HTMLButtonElement>(".new-compare-btn")?.click();
    expect(document.querySelector(".empty-shell")).not.toBeNull();

    renderPending.resolve({ scale: 1, width: 100, height: 100 });
    await flush();

    expect(document.querySelector(".empty-shell")).not.toBeNull();
    expect(document.querySelector(".app-shell")).toBeNull();
  });

  it("throws if the #app root element is missing from the page", async () => {
    document.body.innerHTML = "";
    vi.resetModules();
    await import("../src/lib/pdf");
    await import("../src/lib/compare");

    await expect(import("../src/main")).rejects.toThrow("Missing #app root element");
  });
});
