import { describe, expect, it } from "vitest";
import { normalizeNextPath } from "./next-path";

describe("normalizeNextPath", () => {
  it("accepts allowed internal billing path with query", () => {
    expect(normalizeNextPath("/billing?intent=trial")).toBe("/billing?intent=trial");
  });

  it("rejects absolute urls", () => {
    expect(normalizeNextPath("https://evil.example/steal")).toBeNull();
  });

  it("rejects protocol-relative urls", () => {
    expect(normalizeNextPath("//evil.example/steal")).toBeNull();
  });

  it("rejects disallowed internal paths", () => {
    expect(normalizeNextPath("/admin")).toBeNull();
  });
});
