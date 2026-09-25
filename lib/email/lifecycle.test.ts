import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    emailDelivery: {
      create: vi.fn(),
      update: vi.fn(),
    },
  },
  sendEmail: vi.fn(),
}));

vi.mock("../db/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("./mailer", () => ({ sendEmail: mocks.sendEmail }));

import { sendTrialStartedEmail, sendWelcomeSignupEmail } from "./lifecycle";

function uniqueConstraintError() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });
}

describe("lifecycle emails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPPORT_EMAIL = "support@example.com";
    process.env.GMAIL_SMTP_USER = "sender@example.com";

    mocks.prisma.user.findUnique.mockResolvedValue({
      email: "seller@example.com",
      mlNickname: "Tienda Demo",
    });
    mocks.prisma.emailDelivery.create.mockResolvedValue({ id: "email_1" });
    mocks.prisma.emailDelivery.update.mockResolvedValue({ id: "email_1" });
    mocks.sendEmail.mockResolvedValue({ providerMessageId: "message_1" });
  });

  it("sends and records welcome signup email once", async () => {
    const result = await sendWelcomeSignupEmail("user_1");

    expect(result).toEqual({ sent: true });
    expect(mocks.prisma.emailDelivery.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user_1",
          type: "welcome_signup",
          dedupeKey: "once",
          recipient: "seller@example.com",
          status: "pending",
        }),
      }),
    );
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "seller@example.com",
        subject: "Tu cuenta de MercadoLibs esta lista",
      }),
    );
    expect(mocks.prisma.emailDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "sent",
          providerMessageId: "message_1",
        }),
      }),
    );
  });

  it("skips duplicate lifecycle emails", async () => {
    mocks.prisma.emailDelivery.create.mockRejectedValue(uniqueConstraintError());

    const result = await sendWelcomeSignupEmail("user_1");

    expect(result).toEqual({ sent: false, reason: "duplicate" });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("skips Mercado Libre placeholder emails", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({
      email: "12345@mercadolibre.local",
      mlNickname: "Tienda Demo",
    });

    const result = await sendWelcomeSignupEmail("user_1");

    expect(result).toEqual({ sent: false, reason: "missing_user_email" });
    expect(mocks.prisma.emailDelivery.create).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("records failed delivery without throwing", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.sendEmail.mockRejectedValue(new Error("smtp_failed"));

    const result = await sendTrialStartedEmail({
      userId: "user_1",
      trialEnd: new Date("2026-05-06T00:00:00.000Z"),
    });

    expect(result).toEqual({ sent: false, reason: "send_failed" });
    expect(mocks.prisma.emailDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "failed",
          error: "smtp_failed",
        }),
      }),
    );
    consoleError.mockRestore();
  });
});
