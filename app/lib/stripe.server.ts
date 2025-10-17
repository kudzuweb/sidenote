import Stripe from "stripe";

let stripeClient: Stripe | null = null;

const apiVersion: Stripe.LatestApiVersion = "2024-06-20";

export const getStripe = () => {
  if (stripeClient) return stripeClient;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  stripeClient = new Stripe(secretKey, {
    apiVersion,
  });

  return stripeClient;
};

export type CheckoutSessionOptions = {
  userId: string;
  customerId?: string | null;
  customerEmail?: string | null;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
};

export const createStripeCheckoutSession = async ({
  userId,
  customerId,
  customerEmail,
  priceId,
  successUrl,
  cancelUrl,
}: CheckoutSessionOptions) => {
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    customer: customerId ?? undefined,
    customer_email: customerId ? undefined : customerEmail ?? undefined,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      userId,
    },
    subscription_data: {
      metadata: {
        userId,
      },
    },
  });

  return session;
};

export const createStripePortalSession = async (customerId: string, returnUrl: string) => {
  const stripe = getStripe();

  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
};

