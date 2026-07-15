import { describe, expect, it } from "vitest";
import { isPdfFile, validateDroppedFiles } from "../src/lib/file-validation";

function pdfFile(name: string, type = "application/pdf") {
  return new File(["%PDF-1.4"], name, { type });
}

describe("isPdfFile", () => {
  it("accepts a file with the application/pdf MIME type", () => {
    expect(isPdfFile(pdfFile("lease.pdf"))).toBe(true);
  });

  it("accepts a .pdf extension when the MIME type is missing", () => {
    expect(isPdfFile(pdfFile("lease.pdf", ""))).toBe(true);
  });

  it("rejects a non-PDF file", () => {
    expect(isPdfFile(pdfFile("lease.docx", "application/msword"))).toBe(false);
  });
});

describe("validateDroppedFiles", () => {
  it("returns ok with both files when given two PDFs", () => {
    const fileA = pdfFile("original.pdf");
    const fileB = pdfFile("revised.pdf");

    expect(validateDroppedFiles([fileA, fileB])).toEqual({ status: "ok", fileA, fileB });
  });

  it("prompts for a second file when only one is dropped", () => {
    const fileA = pdfFile("original.pdf");
    expect(validateDroppedFiles([fileA])).toEqual({ status: "need-second-file", fileA });
  });

  it("reports an invalid file by name and reason", () => {
    const result = validateDroppedFiles([pdfFile("notes.txt", "text/plain")]);
    expect(result).toEqual({ status: "invalid", message: `"notes.txt" isn't a PDF file.` });
  });

  it("reports invalid for an empty file list", () => {
    expect(validateDroppedFiles([])).toEqual({
      status: "invalid",
      message: "No files were dropped.",
    });
  });

  it("reports invalid, naming the count, when more than two PDFs are dropped", () => {
    const files = [pdfFile("a.pdf"), pdfFile("b.pdf"), pdfFile("c.pdf")];
    expect(validateDroppedFiles(files)).toEqual({
      status: "invalid",
      message: "Drop exactly two PDFs to compare — 3 were dropped.",
    });
  });

  it("accepts the same File dropped twice without special-casing it", () => {
    const fileA = pdfFile("original.pdf");
    expect(validateDroppedFiles([fileA, fileA])).toEqual({ status: "ok", fileA, fileB: fileA });
  });

  it("accepts an uppercase .PDF extension when the MIME type is missing", () => {
    const file = pdfFile("LEASE.PDF", "");
    expect(isPdfFile(file)).toBe(true);
  });
});
