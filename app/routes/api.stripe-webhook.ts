import type { ActionFunctionArgs } from "react-router";
import Stripe from "stripe";
import { getStripe } from "~/lib/stripe.server";
import { updateSubscription } from "~/server/subscription.server";

const mapStripeStatus = (status: Stripe.Subscription.Status) => {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
    case "paused":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    case "incomplete":
    case "expired":
    default:
      return "inactive";
  }
};

export async function action({ request }: ActionFunctionArgs) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret || !signature) {
    return new Response("Webhook configuration error", { status: 400 });
  }

  const stripe = getStripe();
  const payloadBuffer = Buffer.from(await request.arrayBuffer());

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payloadBuffer, signature, webhookSecret);
  } catch (error) {
    console.error("Stripe webhook signature verification failed", error);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const subscriptionId = session.subscription as string | null;
        const customerId = session.customer as string | null;
        const userId = session.metadata?.userId;

        if (!userId || !subscriptionId) {
          break;
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);

        await updateSubscription(userId, {
          stripeCustomerId: customerId ?? undefined,
          stripeSubscriptionId: subscriptionId,
          status: mapStripeStatus(subscription.status),
          plan: ["active", "trialing", "past_due", "unpaid", "paused"].includes(subscription.status)
            ? "pro"
            : "free",
          currentPeriodEnd: subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000)
            : null,
        });
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;
        if (!userId) break;

        await updateSubscription(userId, {
          stripeCustomerId: subscription.customer as string,
          stripeSubscriptionId: subscription.id,
          status: mapStripeStatus(subscription.status),
          plan: ["active", "trialing", "past_due", "unpaid", "paused"].includes(subscription.status)
            ? "pro"
            : "free",
          currentPeriodEnd: subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000)
            : null,
        });
        break;
      }

      default:
        break;
    }
  } catch (error) {
    console.error("Error processing Stripe webhook", error);
    return new Response("Webhook handler failed", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}
