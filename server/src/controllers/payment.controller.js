import { User } from "../models/User.model.js";
import { Subscription } from "../models/Subscription.model.js";
import {
  createCheckoutSession,
  createBillingPortalSession,
  constructWebhookEvent,
  getStripe,
} from "../services/payment.service.js";

/** Keep access during grace / retry; drop when Stripe says the sub is really gone or never paid. */
function subscriptionGrantsPremium(status) {
  return ["active", "trialing", "past_due"].includes(status);
}

async function upsertSubscriptionFromStripe(userId, stripeSub) {
  const uid = typeof userId === "string" ? userId : userId?.toString?.();
  if (!uid || !stripeSub?.id) return;
  await Subscription.findOneAndUpdate(
    { stripeSubscriptionId: stripeSub.id },
    {
      userId: uid,
      stripeSubscriptionId: stripeSub.id,
      stripePriceId: stripeSub.items?.data?.[0]?.price?.id || "",
      status: stripeSub.status,
      currentPeriodEnd: stripeSub.current_period_end ? new Date(stripeSub.current_period_end * 1000) : null,
      cancelAtPeriodEnd: Boolean(stripeSub.cancel_at_period_end),
    },
    { upsert: true }
  );
}

async function syncPremiumRoleForUser(userId, stripeSub) {
  const user = await User.findById(userId);
  if (!user) return;
  const ok = subscriptionGrantsPremium(stripeSub.status);
  const hasPrem = user.roles.includes("premium");
  if (ok && !hasPrem) user.roles.push("premium");
  if (!ok && hasPrem) user.roles = user.roles.filter((r) => r !== "premium");
  await user.save();
}

export async function createCheckout(req, res, next) {
  try {
    const priceId = process.env.STRIPE_PRICE_PREMIUM || req.body.priceId;
    if (!priceId) return res.status(400).json({ error: "Stripe price not configured" });
    const user = await User.findById(req.user.id);
    const base = process.env.CLIENT_URL || "http://localhost:5173";
    const session = await createCheckoutSession({
      userId: user._id.toString(),
      email: user.email,
      priceId,
      successUrl: `${base}/profile?checkout=success`,
      cancelUrl: `${base}/profile?checkout=cancel`,
      stripeCustomerId: user.stripeCustomerId || undefined,
    });
    res.json({ url: session.url, id: session.id });
  } catch (e) {
    next(e);
  }
}

export async function portal(req, res, next) {
  try {
    const user = await User.findById(req.user.id);
    if (!user.stripeCustomerId) return res.status(400).json({ error: "No billing customer" });
    const base = process.env.CLIENT_URL || "http://localhost:5173";
    const session = await createBillingPortalSession({
      customerId: user.stripeCustomerId,
      returnUrl: `${base}/profile`,
    });
    res.json({ url: session.url });
  } catch (e) {
    next(e);
  }
}

/** Current user's subscription row (if any) for renewals / portal hints. */
export async function subscriptionSummary(req, res, next) {
  try {
    const configured = Boolean(getStripe() && process.env.STRIPE_PRICE_PREMIUM);
    const sub = await Subscription.findOne({ userId: req.user.id }).sort({ updatedAt: -1 }).lean();
    res.json({
      stripeConfigured: configured,
      subscription: sub
        ? {
            status: sub.status,
            currentPeriodEnd: sub.currentPeriodEnd,
            cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          }
        : null,
    });
  } catch (e) {
    next(e);
  }
}

export async function webhook(req, res, next) {
  try {
    const sig = req.headers["stripe-signature"];
    const event = constructWebhookEvent(req.rawBody || req.body, sig);
    const stripe = getStripe();

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userId = session.metadata?.userId || session.client_reference_id;
      if (userId && session.mode === "subscription") {
        const user = await User.findById(userId);
        if (user) {
          if (session.customer) user.stripeCustomerId = String(session.customer);
          if (!user.roles.includes("premium")) user.roles.push("premium");
          await user.save();
          const subId = session.subscription;
          if (stripe && subId) {
            const stripeSub = await stripe.subscriptions.retrieve(subId);
            await upsertSubscriptionFromStripe(user._id, stripeSub);
            await syncPremiumRoleForUser(user._id, stripeSub);
          }
        }
      }
    }

    if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
      const sub = event.data.object;
      let userId = sub.metadata?.userId;
      if (!userId && sub.customer) {
        const cid = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
        const user = await User.findOne({ stripeCustomerId: cid });
        userId = user?._id?.toString();
      }
      if (userId) {
        await upsertSubscriptionFromStripe(userId, sub);
        await syncPremiumRoleForUser(userId, sub);
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
      const user = customerId ? await User.findOne({ stripeCustomerId: customerId }) : null;
      if (user) {
        user.roles = user.roles.filter((r) => r !== "premium");
        await user.save();
      }
      await Subscription.findOneAndUpdate(
        { stripeSubscriptionId: sub.id },
        {
          status: "canceled",
          currentPeriodEnd: sub.ended_at ? new Date(sub.ended_at * 1000) : null,
          cancelAtPeriodEnd: false,
        },
        { upsert: true }
      );
    }

    // Stripe can email upcoming invoices / failed payments when enabled in Dashboard → Customer emails.
    if (event.type === "invoice.upcoming") {
      /* optional: log or enqueue in-app notification */
    }

    res.json({ received: true });
  } catch (e) {
    next(e);
  }
}

export async function mockSubscribe(req, res, next) {
  try {
    if (process.env.NODE_ENV === "production") return res.status(404).end();
    const user = await User.findById(req.user.id);
    if (!user.roles.includes("premium")) user.roles.push("premium");
    await user.save();
    await Subscription.create({
      userId: user._id,
      stripeSubscriptionId: `sub_mock_${user._id}`,
      status: "active",
      currentPeriodEnd: new Date(Date.now() + 86400000 * 30),
    });
    const fresh = await User.findById(user._id);
    res.json({ user: fresh.toPublicJSON() });
  } catch (e) {
    next(e);
  }
}

export function stripeHealth(req, res) {
  res.json({
    configured: Boolean(getStripe() && process.env.STRIPE_PRICE_PREMIUM),
  });
}
