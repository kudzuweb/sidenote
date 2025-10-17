import { getUserDocumentCount } from "./documents.server";
import { getUserSubscription } from "./subscription.server";
import type { SubscriptionStatus, UserSubscriptionRow } from "~/types/types";

const PAYWALL_DOCUMENT_LIMIT = 10;

const paidStatuses: SubscriptionStatus[] = ["active", "trialing", "past_due"];

export const isPaidSubscription = (subscription: UserSubscriptionRow) =>
  subscription.plan === "pro" && paidStatuses.includes(subscription.status);

export const getDocumentLimitInfo = async (userId: string, limit: number = PAYWALL_DOCUMENT_LIMIT) => {
  const [subscription, documentCount] = await Promise.all([
    getUserSubscription(userId),
    getUserDocumentCount(userId),
  ]);

  const subscribed = isPaidSubscription(subscription);
  const remaining = subscribed ? Infinity : Math.max(limit - documentCount, 0);

  return {
    subscription,
    documentCount,
    subscribed,
    limit,
    remaining,
    allowed: subscribed || documentCount < limit,
  };
};

export const ensureDocumentAllowance = async (userId: string, limit: number = PAYWALL_DOCUMENT_LIMIT) => {
  const info = await getDocumentLimitInfo(userId, limit);
  if (!info.allowed) {
    const error = new Error("Document limit reached");
    (error as any).code = "DOCUMENT_LIMIT_REACHED";
    (error as any).payload = info;
    throw error;
  }
  return info;
};

