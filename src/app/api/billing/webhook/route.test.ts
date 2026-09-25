import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    billingSubscription: {
      findUnique: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    stripeWebhookEvent: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
  disconnectUserIntegrationsForBillingEnd: vi.fn(),
  sendTrialStartedEmail: vi.fn(),
  getStripeWebhookSecret: vi.fn(() => "whsec_test"),
  stripe: {
    webhooks: {
      constructEvent: vi.fn(),
    },
    subscriptions: {
      retrieve: vi.fn(),
    },
  },
}));

vi.mock("../../../../../lib/db/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("../../../../../lib/account/disconnect", () => ({
  disconnectUserIntegrationsForBillingEnd: mocks.disconnectUserIntegrationsForBillingEnd,
}));
vi.mock("../../../../../lib/email/lifecycle", () => ({
  sendTrialStartedEmail: mocks.sendTrialStartedEmail,
}));
vi.mock("../../../../../lib/stripe/client", () => ({
  getStripe: vi.fn(() => mocks.stripe),
  getStripeWebhookSecret: mocks.getStripeWebhookSecret,
}));

import { POST } from "./route";

function buildSubscriptionEvent(status: string) {
  return {
    id: `evt_${status}`,
    type: "customer.subscription.updated",
    data: {
      object: {
        id: "sub_1",
        customer: "cus_1",
        metadata: { userId: "user_1" },
        status,
        items: {
          data: [
            {
              price: { id: "price_basic" },
              current_period_start: 1_700_000_000,
              current_period_end: 1_700_086_400,
            },
          ],
        },
        latest_invoice: "in_1",
        cancel_at_period_end: false,
        canceled_at: null,
        trial_start: null,
        trial_end: null,
      },
    },
  };
}

describe("POST /api/billing/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-17T12:00:00.000Z"));

    mocks.prisma.stripeWebhookEvent.create.mockResolvedValue({ id: "claimed" });
    mocks.prisma.stripeWebhookEvent.deleteMany.mockResolvedValue({ count: 0 });
    mocks.prisma.user.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.billingSubscription.update.mockResolvedValue({ id: "billing_1" });
    mocks.prisma.billingSubscription.upsert.mockResolvedValue({ id: "billing_1" });
    mocks.sendTrialStartedEmail.mockResolvedValue({ sent: true });
  });

  it("tracks degradedSince on past_due but does not disconnect before 24h", async () => {
    mocks.stripe.webhooks.constructEvent.mockReturnValue(buildSubscriptionEvent("past_due"));
    mocks.prisma.billingSubscription.findUnique.mockResolvedValue({
      stripeSubscriptionId: "sub_1",
      status: "active",
      degradedSince: null,
    });

    const request = new Request("http://localhost/api/billing/webhook", {
      method: "POST",
      headers: {
        "stripe-signature": "t=123,v1=abc",
      },
      body: JSON.stringify({ any: "payload" }),
    });

    const response = await POST(request as unknown as NextRequest);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.disconnectUserIntegrationsForBillingEnd).not.toHaveBeenCalled();
    expect(mocks.prisma.billingSubscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "past_due",
          degradedSince: new Date("2026-03-17T12:00:00.000Z"),
        }),
      }),
    );
  });

  it("disconnects after past_due grace window elapses", async () => {
    mocks.stripe.webhooks.constructEvent.mockReturnValue(buildSubscriptionEvent("past_due"));
    mocks.prisma.billingSubscription.findUnique.mockResolvedValue({
      stripeSubscriptionId: "sub_1",
      status: "past_due",
      degradedSince: new Date("2026-03-16T11:59:59.000Z"),
    });

    const request = new Request("http://localhost/api/billing/webhook", {
      method: "POST",
      headers: {
        "stripe-signature": "t=123,v1=abc",
      },
      body: JSON.stringify({ any: "payload" }),
    });

    const response = await POST(request as unknown as NextRequest);

    expect(response.status).toBe(200);
    expect(mocks.disconnectUserIntegrationsForBillingEnd).toHaveBeenCalledWith("user_1");
    expect(mocks.prisma.billingSubscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          degradedSince: new Date("2026-03-16T11:59:59.000Z"),
        }),
      }),
    );
  });

  it("disconnects immediately on canceled status", async () => {
    mocks.stripe.webhooks.constructEvent.mockReturnValue(buildSubscriptionEvent("canceled"));
    mocks.prisma.billingSubscription.findUnique.mockResolvedValue({
      stripeSubscriptionId: "sub_1",
      status: "active",
      degradedSince: null,
    });

    const request = new Request("http://localhost/api/billing/webhook", {
      method: "POST",
      headers: {
        "stripe-signature": "t=123,v1=abc",
      },
      body: JSON.stringify({ any: "payload" }),
    });

    const response = await POST(request as unknown as NextRequest);

    expect(response.status).toBe(200);
    expect(mocks.disconnectUserIntegrationsForBillingEnd).toHaveBeenCalledWith("user_1");
  });

  it("sends trial started email once when subscription enters trialing", async () => {
    mocks.stripe.webhooks.constructEvent.mockReturnValue(buildSubscriptionEvent("trialing"));
    mocks.prisma.billingSubscription.findUnique.mockResolvedValue(null);

    const request = new Request("http://localhost/api/billing/webhook", {
      method: "POST",
      headers: {
        "stripe-signature": "t=123,v1=abc",
      },
      body: JSON.stringify({ any: "payload" }),
    });

    const response = await POST(request as unknown as NextRequest);

    expect(response.status).toBe(200);
    expect(mocks.sendTrialStartedEmail).toHaveBeenCalledWith({
      userId: "user_1",
      trialEnd: null,
      currentPeriodEnd: new Date(1_700_086_400 * 1000),
    });
  });
});
