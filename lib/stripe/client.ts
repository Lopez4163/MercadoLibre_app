import Stripe from "stripe";

function getRequiredEnv(name: "STRIPE_SECRET_KEY" | "STRIPE_PRICE_ID" | "STRIPE_WEBHOOK_SECRET") {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export function getStripeSecretKey() {
  const secretKey = getRequiredEnv("STRIPE_SECRET_KEY");
  if (!secretKey.startsWith("sk_")) {
    throw new Error("Invalid STRIPE_SECRET_KEY format.");
  }
  return secretKey;
}

export function getStripePriceId() {
  return getRequiredEnv("STRIPE_PRICE_ID");
}

export function getStripeWebhookSecret() {
  const webhookSecret = getRequiredEnv("STRIPE_WEBHOOK_SECRET");
  if (!webhookSecret.startsWith("whsec_")) {
    throw new Error("Invalid STRIPE_WEBHOOK_SECRET format.");
  }
  return webhookSecret;
}

let stripeClient: Stripe | null = null;

export function getStripe() {
  if (!stripeClient) {
    stripeClient = new Stripe(getStripeSecretKey());
  }

  return stripeClient;
}
