import { describe, expect, it } from "vitest";
import { isPermanentTelegramDeliveryError, TelegramApiError } from "./bot";

describe("TelegramApiError", () => {
  it("marks blocked bot errors as permanent", () => {
    const error = new TelegramApiError({
      method: "sendMessage",
      message: "failed",
      errorCode: 403,
      description: "Forbidden: bot was blocked by the user",
      isPermanent: true,
    });

    expect(isPermanentTelegramDeliveryError(error)).toBe(true);
  });

  it("does not mark transient api errors as permanent", () => {
    const error = new TelegramApiError({
      method: "sendMessage",
      message: "failed",
      errorCode: 429,
      description: "Too Many Requests",
      isPermanent: false,
    });

    expect(isPermanentTelegramDeliveryError(error)).toBe(false);
  });
});
