export type DroppedFilesResult =
  | { status: "ok"; fileA: File; fileB: File }
  | { status: "need-second-file"; fileA: File }
  | { status: "invalid"; message: string };

export function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

/**
 * Validates files dropped/selected for comparison: exactly two PDFs are
 * required. A single file prompts for the second rather than erroring, and a
 * non-PDF file names itself and the reason instead of throwing.
 */
export function validateDroppedFiles(files: File[]): DroppedFilesResult {
  if (files.length === 0) {
    return { status: "invalid", message: "No files were dropped." };
  }

  const nonPdf = files.find((file) => !isPdfFile(file));
  if (nonPdf) {
    return { status: "invalid", message: `"${nonPdf.name}" isn't a PDF file.` };
  }

  if (files.length === 1) {
    return { status: "need-second-file", fileA: files[0] };
  }

  if (files.length > 2) {
    return {
      status: "invalid",
      message: `Drop exactly two PDFs to compare — ${files.length} were dropped.`,
    };
  }

  return { status: "ok", fileA: files[0], fileB: files[1] };
}
