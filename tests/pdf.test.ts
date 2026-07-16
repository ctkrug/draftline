import { describe, expect, it } from "vitest";
import { loadDocument } from "../src/lib/pdf";

describe("loadDocument", () => {
  it("rejects with an error for garbage bytes that aren't a PDF at all", async () => {
    const garbage = new Uint8Array([1, 2, 3, 4, 5]);
    await expect(loadDocument(garbage)).rejects.toThrow();
  });

  it("rejects with an error for a zero-byte file", async () => {
    await expect(loadDocument(new Uint8Array(0))).rejects.toThrow();
  });
});
