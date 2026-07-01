import { z } from "zod";
import { createRouter, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  bookings,
  barbers,
  services,
  users,
  notifications,
} from "@db/schema";
import { eq, and, gte, sql, desc, count } from "drizzle-orm";

export const adminRouter = createRouter({
  getStats: adminQuery
    .input(
      z
        .object({
          period: z.enum(["today", "week", "month"]).optional().default("today"),
        })
        .optional()
        .default({})
    )
    .query(async ({ input }) => {
      const db = getDb();

      let dateFilter = new Date();
      if (input.period === "week") {
        dateFilter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      } else if (input.period === "month") {
        dateFilter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      }

      // Today's bookings
      const [bookingsCount] = await db
        .select({ count: count() })
        .from(bookings)
        .where(gte(bookings.createdAt, dateFilter));

      // Active barbers
      const [barbersCount] = await db
        .select({ count: count() })
        .from(barbers)
        .where(eq(barbers.isActive, true));

      // Total revenue
      const [revenueResult] = await db
        .select({ total: sql<number>`COALESCE(SUM(${bookings.price}), 0)` })
        .from(bookings)
        .where(
          and(
            gte(bookings.createdAt, dateFilter),
            eq(bookings.status, "completed")
          )
        );

      // New clients
      const [clientsCount] = await db
        .select({ count: count() })
        .from(users)
        .where(
          and(gte(users.createdAt, dateFilter), eq(users.role, "client"))
        );

      return {
        bookings: bookingsCount?.count ?? 0,
        barbers: barbersCount?.count ?? 0,
        revenue: revenueResult?.total ?? 0,
        clients: clientsCount?.count ?? 0,
        period: input.period,
      };
    }),

  getBookings: adminQuery
    .input(
      z
        .object({
          date: z.string().optional(),
          status: z.string().optional(),
          page: z.number().optional().default(1),
          limit: z.number().optional().default(20),
        })
        .optional()
        .default({})
    )
    .query(async ({ input }) => {
      const db = getDb();
      const offset = (input.page - 1) * input.limit;

      let conditions = [];
      if (input.status) {
        conditions.push(eq(bookings.status, input.status as any));
      }
      if (input.date) {
        conditions.push(eq(bookings.bookingDate, new Date(input.date)));
      }

      const query =
        conditions.length > 0
          ? db
              .select()
              .from(bookings)
              .where(and(...conditions))
              .orderBy(desc(bookings.createdAt))
              .limit(input.limit)
              .offset(offset)
          : db
              .select()
              .from(bookings)
              .orderBy(desc(bookings.createdAt))
              .limit(input.limit)
              .offset(offset);

      const allBookings = await query;

      // Enrich with names
      const enriched = await Promise.all(
        allBookings.map(async (b) => {
          const [client] = await db
            .select({ name: users.name })
            .from(users)
            .where(eq(users.id, b.clientId))
            .limit(1);
          const [barber] = await db
            .select({ shopName: barbers.shopName })
            .from(barbers)
            .where(eq(barbers.id, b.barberId))
            .limit(1);
          const [service] = await db
            .select({ name: services.name })
            .from(services)
            .where(eq(services.id, b.serviceId))
            .limit(1);
          return {
            ...b,
            clientName: client?.name ?? "Клиент",
            barberName: barber?.shopName ?? "Мастер",
            serviceName: service?.name ?? "Услуга",
          };
        })
      );

      return enriched;
    }),

  getBarbers: adminQuery
    .input(
      z
        .object({
          status: z.enum(["active", "inactive"]).optional(),
          page: z.number().optional().default(1),
          limit: z.number().optional().default(20),
        })
        .optional()
        .default({})
    )
    .query(async ({ input }) => {
      const db = getDb();
      const offset = (input.page - 1) * input.limit;

      let query = db.select().from(barbers);
      if (input.status) {
        query = query.where(
          eq(barbers.isActive, input.status === "active")
        );
      }

      return query.limit(input.limit).offset(offset);
    }),

  updateBarberStatus: adminQuery
    .input(
      z.object({
        id: z.number(),
        isActive: z.boolean(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(barbers)
        .set({ isActive: input.isActive })
        .where(eq(barbers.id, input.id));
      return { success: true };
    }),

  getRevenue: adminQuery
    .input(
      z
        .object({
          startDate: z.string().optional(),
          endDate: z.string().optional(),
        })
        .optional()
        .default({})
    )
    .query(async ({ input }) => {
      const db = getDb();

      const start = input.startDate
        ? new Date(input.startDate)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = input.endDate ? new Date(input.endDate) : new Date();

      const dailyRevenue = await db
        .select({
          date: bookings.bookingDate,
          total: sql<number>`COALESCE(SUM(${bookings.price}), 0)`,
          count: count(),
        })
        .from(bookings)
        .where(
          and(
            gte(bookings.bookingDate, start),
            lteDate(bookings.bookingDate, end),
            eq(bookings.status, "completed")
          )
        )
        .groupBy(bookings.bookingDate)
        .orderBy(bookings.bookingDate);

      const [totalResult] = await db
        .select({ total: sql<number>`COALESCE(SUM(${bookings.price}), 0)` })
        .from(bookings)
        .where(
          and(
            gte(bookings.bookingDate, start),
            lteDate(bookings.bookingDate, end),
            eq(bookings.status, "completed")
          )
        );

      return {
        daily: dailyRevenue,
        total: totalResult?.total ?? 0,
      };
    }),

  sendNotification: adminQuery
    .input(
      z.object({
        userIds: z.array(z.number()),
        title: z.string(),
        message: z.string(),
        type: z.enum(["booking", "reminder", "promo", "system"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      for (const userId of input.userIds) {
        await db.insert(notifications).values({
          userId,
          type: input.type,
          title: input.title,
          message: input.message,
        });
      }

      return { success: true, sent: input.userIds.length };
    }),
});

function lteDate(column: any, date: Date) {
  return sql`${column} <= ${date}`;
}
