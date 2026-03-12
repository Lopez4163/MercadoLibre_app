import { describe, expect, it } from "vitest";
import {
  createOAuthStateToken,
  getOAuthStateReturnTo,
  isValidOAuthStatePair,
  isValidOAuthStateToken,
} from "./oauth-state";

describe("oauth state", () => {
  it("validates a fresh signed state token", () => {
    const now = new Date("2026-03-08T12:00:00.000Z");
    const state = createOAuthStateToken({
      now,
      secret: "test-secret",
      ttlSeconds: 300,
    });

    expect(
      isValidOAuthStateToken(state, {
        now: new Date("2026-03-08T12:02:00.000Z"),
        secret: "test-secret",
      }),
    ).toBe(true);
  });

  it("rejects expired state token", () => {
    const state = createOAuthStateToken({
      now: new Date("2026-03-08T12:00:00.000Z"),
      secret: "test-secret",
      ttlSeconds: 60,
    });

    expect(
      isValidOAuthStateToken(state, {
        now: new Date("2026-03-08T12:05:00.000Z"),
        secret: "test-secret",
      }),
    ).toBe(false);
  });

  it("rejects tampered state token", () => {
    const state = createOAuthStateToken({ secret: "test-secret" });
    expect(
      isValidOAuthStateToken(`${state}a`, {
        secret: "test-secret",
      }),
    ).toBe(false);
  });

  it("requires query state and cookie state to match", () => {
    const state = createOAuthStateToken({ secret: "test-secret" });
    const otherState = createOAuthStateToken({ secret: "test-secret" });

    expect(
      isValidOAuthStatePair(state, state, {
        secret: "test-secret",
      }),
    ).toBe(true);

    expect(
      isValidOAuthStatePair(state, otherState, {
        secret: "test-secret",
      }),
    ).toBe(false);
  });

  it("extracts signed returnTo when present", () => {
    const state = createOAuthStateToken({
      secret: "test-secret",
      returnTo: "/billing?intent=trial",
    });

    expect(
      getOAuthStateReturnTo(state, {
        secret: "test-secret",
      }),
    ).toBe("/billing?intent=trial");
  });
});
