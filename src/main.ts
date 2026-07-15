import { appReducer, initialAppState } from "./lib/app-state";
import { compareDocuments, describePageCountDifference } from "./lib/compare";
import { validateDroppedFiles } from "./lib/file-validation";
import { buildOverlayMarks } from "./lib/overlay";
import { loadDocument, renderPageToCanvas } from "./lib/pdf";
import type { AppAction, AppState } from "./lib/app-state";
import type { PageCompareResult } from "./lib/compare";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) {
  throw new Error("Missing #app root element");
}

let state: AppState = initialAppState;
let currentPageNumber = 1;
let activeCompareController: AbortController | null = null;

function dispatch(action: AppAction): void {
  state = appReducer(state, action);
  render();
}

function wordmark(): HTMLElement {
  const el = document.createElement("div");
  el.className = "wordmark";
  el.innerHTML = `Draft<span class="wordmark-line">line</span>`;
  return el;
}

function buildDropzone(promptText: string): HTMLElement {
  const dz = document.createElement("div");
  dz.className = "dropzone";
  dz.tabIndex = 0;
  dz.setAttribute("role", "button");
  dz.setAttribute("aria-label", "Drop two PDF files to compare, or press Enter to choose files");

  const label = document.createElement("span");
  label.className = "dropzone-label";
  label.textContent = promptText;
  dz.appendChild(label);

  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/pdf,.pdf";
  input.multiple = true;
  input.hidden = true;
  input.setAttribute("aria-hidden", "true");
  dz.appendChild(input);

  dz.addEventListener("click", () => input.click());
  dz.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      input.click();
    }
  });

  input.addEventListener("change", () => {
    if (input.files) handleFiles(Array.from(input.files));
    input.value = "";
  });

  dz.addEventListener("dragover", (event) => {
    event.preventDefault();
    dz.classList.add("dropzone--dragover");
  });
  dz.addEventListener("dragleave", () => dz.classList.remove("dropzone--dragover"));
  dz.addEventListener("drop", (event) => {
    event.preventDefault();
    dz.classList.remove("dropzone--dragover");
    dz.classList.add("dropzone--flash");
    setTimeout(() => dz.classList.remove("dropzone--flash"), 200);
    if (event.dataTransfer?.files) handleFiles(Array.from(event.dataTransfer.files));
  });

  return dz;
}

function buildEmptyState(): HTMLElement {
  const container = document.createElement("div");
  container.className = "empty-shell";
  container.appendChild(wordmark());
  container.appendChild(buildDropzone("Drop two PDFs here, or click to choose files"));

  const copy = document.createElement("p");
  copy.className = "empty-copy";
  copy.innerHTML =
    "Your files never leave this browser — nothing is uploaded, ever." +
    "<br />Compare two drafts of a contract or lease and see exactly what changed.";
  container.appendChild(copy);

  return container;
}

function buildNeedSecondFileState(fileA: File): HTMLElement {
  const container = document.createElement("div");
  container.className = "empty-shell";
  container.appendChild(wordmark());

  const banner = document.createElement("div");
  banner.className = "banner banner--info";
  banner.setAttribute("role", "status");
  banner.textContent = `Got "${fileA.name}" — drop or choose the second PDF to compare it against.`;
  container.appendChild(banner);

  container.appendChild(buildDropzone("Drop the second PDF here"));
  return container;
}

function buildErrorState(message: string): HTMLElement {
  const container = document.createElement("div");
  container.className = "empty-shell";
  container.appendChild(wordmark());

  const banner = document.createElement("div");
  banner.className = "banner banner--error";
  banner.setAttribute("role", "alert");
  banner.textContent = message;
  container.appendChild(banner);

  container.appendChild(buildDropzone("Try again — drop two PDFs here"));
  return container;
}

function buildLoadingState(): HTMLElement {
  const container = document.createElement("div");
  container.className = "empty-shell";
  container.appendChild(wordmark());

  const loading = document.createElement("div");
  loading.className = "loading";
  loading.setAttribute("role", "status");
  loading.setAttribute("aria-live", "polite");

  const rule = document.createElement("div");
  rule.className = "loading-rule";
  loading.appendChild(rule);

  const text = document.createElement("p");
  text.className = "loading-text";
  text.textContent = "Comparing documents…";
  loading.appendChild(text);

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "cancel-btn";
  cancelButton.textContent = "Cancel";
  cancelButton.addEventListener("click", () => activeCompareController?.abort());
  loading.appendChild(cancelButton);

  container.appendChild(loading);
  return container;
}

function fileInfoRow(label: string, fileName: string): HTMLElement {
  const row = document.createElement("div");
  const labelEl = document.createElement("span");
  labelEl.className = "file-info-label";
  labelEl.textContent = label;
  row.appendChild(labelEl);
  row.append(` ${fileName}`);
  return row;
}

function pageLabel(page: PageCompareResult): string {
  if (page.status === "added") return `Page ${page.pageNumber} — added`;
  if (page.status === "removed") return `Page ${page.pageNumber} — removed`;
  return `Page ${page.pageNumber}`;
}

function buildReadyShell(readyState: Extract<AppState, { phase: "ready" }>): HTMLElement {
  const shell = document.createElement("div");
  shell.className = "app-shell";

  const topbar = document.createElement("header");
  topbar.className = "topbar";
  topbar.appendChild(wordmark());

  const stats = document.createElement("div");
  stats.className = "stats";
  stats.setAttribute("aria-live", "polite");
  stats.innerHTML =
    `<span class="stat">${readyState.result.totals.pagesChanged} page` +
    `${readyState.result.totals.pagesChanged === 1 ? "" : "s"} changed</span>` +
    `<span class="stat stat--ins">+${readyState.result.totals.additions}</span>` +
    `<span class="stat stat--del">−${readyState.result.totals.deletions}</span>`;
  topbar.appendChild(stats);

  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.className = "new-compare-btn";
  resetButton.textContent = "New comparison";
  resetButton.addEventListener("click", () => dispatch({ type: "RESET" }));
  topbar.appendChild(resetButton);

  shell.appendChild(topbar);

  const workspace = document.createElement("div");
  workspace.className = "workspace";

  const rail = document.createElement("aside");
  rail.className = "rail";

  const fileInfo = document.createElement("div");
  fileInfo.className = "file-info";
  fileInfo.appendChild(fileInfoRow("Original", readyState.fileNameA));
  fileInfo.appendChild(fileInfoRow("Revised", readyState.fileNameB));
  rail.appendChild(fileInfo);

  if (readyState.pageCountMessage) {
    const banner = document.createElement("div");
    banner.className = "banner banner--info banner--compact";
    banner.setAttribute("role", "status");
    banner.textContent = readyState.pageCountMessage;
    rail.appendChild(banner);
  }

  const nav = document.createElement("nav");
  nav.className = "page-nav";
  nav.setAttribute("aria-label", "Pages");

  const list = document.createElement("ol");
  for (const page of readyState.result.pages) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "page-nav-item";
    if (page.status !== "compared" || page.hasChanges) {
      button.classList.add("page-nav-item--changed");
    }
    if (page.pageNumber === currentPageNumber) {
      button.setAttribute("aria-current", "true");
      button.classList.add("page-nav-item--active");
    }
    button.textContent = pageLabel(page);
    button.addEventListener("click", () => {
      currentPageNumber = page.pageNumber;
      for (const el of list.querySelectorAll(".page-nav-item")) {
        el.classList.remove("page-nav-item--active");
        el.removeAttribute("aria-current");
      }
      button.classList.add("page-nav-item--active");
      button.setAttribute("aria-current", "true");
      void renderCurrentPage();
    });
    item.appendChild(button);
    list.appendChild(item);
  }
  nav.appendChild(list);
  rail.appendChild(nav);

  workspace.appendChild(rail);

  const stage = document.createElement("main");
  stage.className = "stage";

  const canvasWrap = document.createElement("div");
  canvasWrap.className = "page-canvas-wrap";

  const canvas = document.createElement("canvas");
  canvas.className = "page-canvas";
  canvasWrap.appendChild(canvas);

  const overlayLayer = document.createElement("div");
  overlayLayer.className = "overlay-layer";
  overlayLayer.setAttribute("aria-hidden", "true");
  canvasWrap.appendChild(overlayLayer);

  stage.appendChild(canvasWrap);

  const caption = document.createElement("p");
  caption.className = "stage-caption";
  stage.appendChild(caption);

  workspace.appendChild(stage);
  shell.appendChild(workspace);

  return shell;
}

async function renderCurrentPage(): Promise<void> {
  if (state.phase !== "ready" || !root) return;

  const wrap = root.querySelector<HTMLDivElement>(".page-canvas-wrap");
  const canvas = root.querySelector<HTMLCanvasElement>(".page-canvas");
  const overlayLayer = root.querySelector<HTMLDivElement>(".overlay-layer");
  const caption = root.querySelector<HTMLParagraphElement>(".stage-caption");
  if (!wrap || !canvas || !overlayLayer || !caption) return;

  overlayLayer.innerHTML = "";
  caption.textContent = "";
  overlayLayer.classList.remove("overlay-layer--added", "overlay-layer--removed");

  const pageResult = state.result.pages.find((p) => p.pageNumber === currentPageNumber);
  if (!pageResult) return;

  const cssWidth = wrap.clientWidth || 800;
  const pixelRatio = window.devicePixelRatio || 1;

  if (pageResult.status === "removed") {
    const page = await state.docA.getPage(currentPageNumber);
    const viewport = await renderPageToCanvas(page, canvas, cssWidth, pixelRatio);
    canvasWrapMatchOverlaySize(overlayLayer, viewport.width, viewport.height);
    overlayLayer.classList.add("overlay-layer--removed");
    caption.textContent = "This page was removed from the revised document.";
    return;
  }

  if (pageResult.status === "added") {
    const page = await state.docB.getPage(currentPageNumber);
    const viewport = await renderPageToCanvas(page, canvas, cssWidth, pixelRatio);
    canvasWrapMatchOverlaySize(overlayLayer, viewport.width, viewport.height);
    overlayLayer.classList.add("overlay-layer--added");
    caption.textContent = "This page was added in the revised document.";
    return;
  }

  const page = await state.docB.getPage(currentPageNumber);
  const viewport = await renderPageToCanvas(page, canvas, cssWidth, pixelRatio);
  canvasWrapMatchOverlaySize(overlayLayer, viewport.width, viewport.height);

  if (pageResult.ops.length === 0) {
    caption.textContent = "No extractable text found on this page.";
    return;
  }

  const marks = buildOverlayMarks(pageResult.ops);
  for (const mark of marks) {
    const el = document.createElement("div");
    if (mark.type === "insert") {
      el.className = "mark mark--insert";
      el.style.left = `${mark.x * viewport.scale}px`;
      el.style.top = `${mark.y * viewport.scale}px`;
      el.style.width = `${mark.width * viewport.scale}px`;
      el.style.height = `${mark.height * viewport.scale}px`;
    } else {
      el.className = "mark mark--delete";
      el.style.left = `${mark.x * viewport.scale}px`;
      el.style.top = `${mark.y * viewport.scale}px`;
      el.style.height = `${mark.height * viewport.scale}px`;
      el.textContent = `− ${mark.text}`;
    }
    overlayLayer.appendChild(el);
  }
}

function canvasWrapMatchOverlaySize(
  overlayLayer: HTMLDivElement,
  width: number,
  height: number,
): void {
  overlayLayer.style.width = `${width}px`;
  overlayLayer.style.height = `${height}px`;
}

window.addEventListener("resize", () => {
  if (state.phase === "ready") void renderCurrentPage();
});

function render(): void {
  if (!root) return;
  root.innerHTML = "";

  switch (state.phase) {
    case "empty":
      root.appendChild(buildEmptyState());
      break;
    case "need-second-file":
      root.appendChild(buildNeedSecondFileState(state.fileA));
      break;
    case "error":
      root.appendChild(buildErrorState(state.message));
      break;
    case "loading":
      root.appendChild(buildLoadingState());
      break;
    case "ready":
      currentPageNumber = 1;
      root.appendChild(buildReadyShell(state));
      void renderCurrentPage();
      break;
  }
}

function handleFiles(files: File[]): void {
  const combined = state.phase === "need-second-file" ? [state.fileA, ...files] : files;
  const validation = validateDroppedFiles(combined);

  if (validation.status === "invalid") {
    dispatch({ type: "FILES_INVALID", message: validation.message });
    return;
  }

  if (validation.status === "need-second-file") {
    dispatch({ type: "NEED_SECOND_FILE", fileA: validation.fileA });
    return;
  }

  void loadAndCompare(validation.fileA, validation.fileB);
}

async function loadAndCompare(fileA: File, fileB: File): Promise<void> {
  dispatch({ type: "LOADING" });

  const controller = new AbortController();
  activeCompareController = controller;

  try {
    const [bytesA, bytesB] = await Promise.all([fileA.arrayBuffer(), fileB.arrayBuffer()]);
    const [docA, docB] = await Promise.all([loadDocument(bytesA), loadDocument(bytesB)]);
    const result = await compareDocuments(docA, docB, undefined, controller.signal);
    const pageCountMessage = describePageCountDifference(result.pageCount.a, result.pageCount.b);

    dispatch({
      type: "DOCS_READY",
      fileNameA: fileA.name,
      fileNameB: fileB.name,
      docA,
      docB,
      result,
      pageCountMessage,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      dispatch({ type: "RESET" });
      return;
    }
    dispatch({
      type: "LOAD_FAILED",
      message: error instanceof Error ? error.message : "Could not read one of the PDF files.",
    });
  } finally {
    activeCompareController = null;
  }
}

render();
