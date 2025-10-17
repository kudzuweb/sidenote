import { eq } from "drizzle-orm";
import { userSubscriptionTable } from "~/db/schema";
import { db } from "~/server/index.server";
import type { SubscriptionPlan, SubscriptionStatus, UserSubscriptionRow } from "~/types/types";

const defaultSubscription = {
  plan: "free" as SubscriptionPlan,
  status: "inactive" as SubscriptionStatus,
};

export const getUserSubscription = async (userId: string): Promise<UserSubscriptionRow> => {
  const existing = await db
    .select()
    .from(userSubscriptionTable)
    .where(eq(userSubscriptionTable.userId, userId));

  if (existing.length > 0) {
    return existing[0];
  }

  const [created] = await db
    .insert(userSubscriptionTable)
    .values({
      userId,
      plan: defaultSubscription.plan,
      status: defaultSubscription.status,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return created;
};

export const updateSubscription = async (
  userId: string,
  updates: Partial<Pick<UserSubscriptionRow, "plan" | "status" | "stripeCustomerId" | "stripeSubscriptionId" | "currentPeriodEnd">>
): Promise<UserSubscriptionRow> => {
  const [updated] = await db
    .update(userSubscriptionTable)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(userSubscriptionTable.userId, userId))
    .returning();

  if (!updated) {
    const [created] = await db
      .insert(userSubscriptionTable)
      .values({
        userId,
        plan: updates.plan ?? defaultSubscription.plan,
        status: updates.status ?? defaultSubscription.status,
        stripeCustomerId: updates.stripeCustomerId,
        stripeSubscriptionId: updates.stripeSubscriptionId,
        currentPeriodEnd: updates.currentPeriodEnd,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return created;
  }

  return updated;
};

export const setSubscriptionStatus = async (
  userId: string,
  status: SubscriptionStatus,
  plan: SubscriptionPlan = status === "active" || status === "trialing" ? "pro" : "free"
) => {
  return updateSubscription(userId, { status, plan });
};

