import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { notifications } from "@db/schema";
import { eq, and, desc, count } from "drizzle-orm";

export const notificationRouter = createRouter({
  list: authedQuery
    .input(
      z
        .object({
          unreadOnly: z.boolean().optional(),
        })
        .optional()
        .default({})
    )
    .query(async ({ input, ctx }) => {
      const db = getDb();

      let conditions = [eq(notifications.userId, ctx.user.id)];

      if (input.unreadOnly) {
        conditions.push(eq(notifications.isRead, false));
      }

      return db
        .select()
        .from(notifications)
        .where(and(...conditions))
        .orderBy(desc(notifications.createdAt))
        .limit(50);
    }),

  getUnreadCount: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const [result] = await db
      .select({ count: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, ctx.user.id),
          eq(notifications.isRead, false)
        )
      );
    return { count: result?.count ?? 0 };
  }),

  markRead: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(
          and(
            eq(notifications.id, input.id),
            eq(notifications.userId, ctx.user.id)
          )
        );
      return { success: true };
    }),

  markAllRead: authedQuery.mutation(async ({ ctx }) => {
    const db = getDb();
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, ctx.user.id));
    return { success: true };
  }),

  clearAll: authedQuery.mutation(async ({ ctx }) => {
    const db = getDb();
    await db
      .delete(notifications)
      .where(eq(notifications.userId, ctx.user.id));
    return { success: true };
  }),
});
