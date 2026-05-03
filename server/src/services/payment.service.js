import Stripe from "stripe";

let stripe;

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!stripe) stripe = new Stripe(key);
  return stripe;
}

export async function createCheckoutSession({ userId, email, priceId, successUrl, cancelUrl, stripeCustomerId }) {
  const s = getStripe();
  if (!s) throw new Error("Stripe not configured");
  const params = {
    mode: "subscription",
    client_reference_id: userId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { userId },
    allow_promotion_codes: true,
    subscription_data: {
      metadata: { userId },
    },
  };
  if (stripeCustomerId) {
    params.customer = stripeCustomerId;
  } else {
    params.customer_email = email;
  }
  const session = await s.checkout.sessions.create(params);
  return session;
}

export async function createBillingPortalSession({ customerId, returnUrl }) {
  const s = getStripe();
  if (!s) throw new Error("Stripe not configured");
  return s.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
}

export function constructWebhookEvent(rawBody, signature) {
  const s = getStripe();
  if (!s) throw new Error("Stripe not configured");
  return s.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
}
