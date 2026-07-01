import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { subscriptions, barbers } from "@db/schema";
import { eq, and, gte, desc } from "drizzle-orm";

const TIER_FEATURES = {
  free: {
    dailyBookings: 5,
    pushNotifications: false,
    searchPriority: "low",
    analytics: "basic",
    barberProfiles: 1,
    apiAccess: false,
    support: "email",
  },
  pro: {
    dailyBookings: Infinity,
    pushNotifications: true,
    searchPriority: "high",
    analytics: "advanced",
    barberProfiles: 1,
    apiAccess: false,
    support: "priority",
  },
  business: {
    dailyBookings: Infinity,
    pushNotifications: true,
    searchPriority: "highest",
    analytics: "full",
    barberProfiles: Infinity,
    apiAccess: true,
    support: "dedicated",
  },
};

export const subscriptionRouter = createRouter({
  getCurrent: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, ctx.user.id),
          eq(subscriptions.status, "active"),
          gte(subscriptions.expiresAt, new Date())
        )
      )
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);

    if (!sub) {
      return {
        tier: "free" as const,
        features: TIER_FEATURES.free,
        expiresAt: null,
      };
    }

    return {
      ...sub,
      features: TIER_FEATURES[sub.tier as keyof typeof TIER_FEATURES],
    };
  }),

  getTiers: publicQuery.query(() => {
    return [
      {
        id: "free",
        name: "Базовая",
        price: 0,
        period: "месяц",
        features: [
          "До 5 записей в день",
          "Базовый профиль",
          "Email-уведомления",
        ],
      },
      {
        id: "pro",
        name: "Про",
        price: 2990,
        period: "месяц",
        popular: true,
        features: [
          "Безлимитные записи",
          "Push-уведомления",
          "Приоритет в поиске",
          "Аналитика",
        ],
      },
      {
        id: "business",
        name: "Бизнес",
        price: 7990,
        period: "месяц",
        features: [
          "Всё из Про",
          "Несколько мастеров",
          "API доступ",
          "Персональный менеджер",
        ],
      },
    ];
  }),

  subscribe: authedQuery
    .input(
      z.object({
        tier: z.enum(["pro", "business"]),
        paymentMethod: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();

      const price = input.tier === "pro" ? 2990 : 7990;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const [sub] = await db.insert(subscriptions).values({
        userId: ctx.user.id,
        tier: input.tier,
        status: "active",
        startedAt: now,
        expiresAt,
        price,
        paymentMethod: input.paymentMethod,
      });

      // Update barber subscription tier
      await db
        .update(barbers)
        .set({
          subscriptionTier: input.tier,
          subscriptionExpiry: expiresAt,
        })
        .where(eq(barbers.userId, ctx.user.id));

      return {
        subscription: {
          id: Number(sub.insertId),
          tier: input.tier,
          status: "active",
          expiresAt,
          price,
        },
      };
    }),

  cancel: authedQuery.mutation(async ({ ctx }) => {
    const db = getDb();
    await db
      .update(subscriptions)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(subscriptions.userId, ctx.user.id),
          eq(subscriptions.status, "active")
        )
      );

    // Revert to free
    await db
      .update(barbers)
      .set({ subscriptionTier: "free" })
      .where(eq(barbers.userId, ctx.user.id));

    return { success: true };
  }),

  checkFeature: authedQuery
    .input(z.object({ feature: z.string() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const [sub] = await db
        .select()
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.userId, ctx.user.id),
            eq(subscriptions.status, "active"),
            gte(subscriptions.expiresAt, new Date())
          )
        )
        .orderBy(desc(subscriptions.createdAt))
        .limit(1);

      const tier = (sub?.tier ?? "free") as keyof typeof TIER_FEATURES;
      const features = TIER_FEATURES[tier];

      return {
        allowed: features[input.feature as keyof typeof features] !== undefined
          ? Boolean(features[input.feature as keyof typeof features])
          : true,
        tier,
      };
    }),
});
