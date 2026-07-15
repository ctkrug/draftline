import { appReducer, initialAppState } from "./lib/app-state";
import { compareDocuments, describePageCountDifference } from "./lib/compare";
import { validateDroppedFiles } from "./lib/file-validation";
import { loadDocument } from "./lib/pdf";
import type { AppAction, AppState } from "./lib/app-state";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) {
  throw new Error("Missing #app root element");
}

let state: AppState = initialAppState;

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

  container.appendChild(loading);
  return container;
}

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
      // The compare view (canvas + overlay + page nav) lands next.
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

  try {
    const [bytesA, bytesB] = await Promise.all([fileA.arrayBuffer(), fileB.arrayBuffer()]);
    const [docA, docB] = await Promise.all([loadDocument(bytesA), loadDocument(bytesB)]);
    const result = await compareDocuments(docA, docB);
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
    dispatch({
      type: "LOAD_FAILED",
      message: error instanceof Error ? error.message : "Could not read one of the PDF files.",
    });
  }
}

render();
