import type { ActionFunctionArgs } from "react-router";
import { createStripeCheckoutSession, createStripePortalSession } from "~/lib/stripe.server";
import { requireUser } from "~/server/auth.server";
import { getUserSubscription } from "~/server/subscription.server";
import { getUserById } from "~/server/users.server";

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUser(request);
  const { intent } = await request.json().catch(() => ({}));

  if (!intent) {
    return Response.json({ success: false, error: "Missing intent" }, { status: 400 });
  }

  const subscription = await getUserSubscription(userId);
  const origin = new URL(request.url).origin;

  if (intent === "checkout") {
    if (subscription.plan === "pro" && subscription.status === "active") {
      return Response.json({ success: true, alreadySubscribed: true });
    }

    const priceId = process.env.STRIPE_PRICE_ID;
    if (!priceId) {
      return Response.json({ success: false, error: "Stripe price not configured" }, { status: 500 });
    }

    const user = await getUserById(userId);
    if (!user?.email) {
      return Response.json({ success: false, error: "User email is required to start checkout" }, { status: 400 });
    }

    const session = await createStripeCheckoutSession({
      userId,
      customerId: subscription.stripeCustomerId,
      customerEmail: user.email,
      priceId,
      successUrl: `${origin}/workspace?billing=success`,
      cancelUrl: `${origin}/workspace?billing=cancelled`,
    });

    return Response.json({ success: true, url: session.url });
  }

  if (intent === "portal") {
    if (!subscription.stripeCustomerId) {
      return Response.json({ success: false, error: "No Stripe customer available" }, { status: 400 });
    }

    const portal = await createStripePortalSession(subscription.stripeCustomerId, `${origin}/workspace`);
    return Response.json({ success: true, url: portal.url });
  }

  return Response.json({ success: false, error: "Unsupported intent" }, { status: 400 });
}
