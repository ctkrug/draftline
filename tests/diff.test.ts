import { describe, expect, it } from "vitest";
import { diffWords, tokenize } from "../src/lib/diff";

describe("tokenize", () => {
  it("splits on words and keeps trailing whitespace attached", () => {
    expect(tokenize("the quick fox")).toEqual(["the ", "quick ", "fox"]);
  });

  it("returns an empty array for empty input", () => {
    expect(tokenize("")).toEqual([]);
  });
});

describe("diffWords", () => {
  it("returns a single equal op for identical text", () => {
    const ops = diffWords("the tenant shall pay rent", "the tenant shall pay rent");
    expect(ops).toEqual([{ type: "equal", value: "the tenant shall pay rent" }]);
  });

  it("isolates a single changed word instead of the whole sentence", () => {
    const ops = diffWords("the tenant shall pay rent", "the tenant may pay rent");

    expect(ops).toEqual([
      { type: "equal", value: "the tenant " },
      { type: "delete", value: "shall " },
      { type: "insert", value: "may " },
      { type: "equal", value: "pay rent" },
    ]);
  });

  it("marks a trailing addition as an appended insert", () => {
    const ops = diffWords("the tenant shall pay rent", "the tenant shall pay rent and fees");

    expect(ops).toEqual([
      { type: "equal", value: "the tenant shall pay " },
      { type: "delete", value: "rent" },
      { type: "insert", value: "rent and fees" },
    ]);
  });

  it("marks a full deletion as delete-only", () => {
    const ops = diffWords("the tenant shall pay rent", "");
    expect(ops).toEqual([{ type: "delete", value: "the tenant shall pay rent" }]);
  });
});
