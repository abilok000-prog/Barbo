import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { reviews, bookings, barbers } from "@db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export const reviewRouter = createRouter({
  create: authedQuery
    .input(
      z.object({
        bookingId: z.number(),
        rating: z.number().min(1).max(5),
        comment: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();

      // Verify booking belongs to user and is completed
      const [booking] = await db
        .select()
        .from(bookings)
        .where(
          and(
            eq(bookings.id, input.bookingId),
            eq(bookings.clientId, ctx.user.id)
          )
        )
        .limit(1);

      if (!booking) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Бронирование не найдено",
        });
      }

      if (booking.status !== "completed") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Можно оставить отзыв только после завершения услуги",
        });
      }

      // Check if review already exists
      const [existing] = await db
        .select()
        .from(reviews)
        .where(eq(reviews.bookingId, input.bookingId))
        .limit(1);

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Вы уже оставили отзыв на эту запись",
        });
      }

      const [review] = await db.insert(reviews).values({
        bookingId: input.bookingId,
        clientId: ctx.user.id,
        barberId: booking.barberId,
        rating: input.rating,
        comment: input.comment,
      });

      // Update barber rating
      const allReviews = await db
        .select()
        .from(reviews)
        .where(eq(reviews.barberId, booking.barberId));

      const avgRating =
        allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;

      await db
        .update(barbers)
        .set({
          rating: avgRating.toFixed(1),
          reviewCount: allReviews.length,
        })
        .where(eq(barbers.id, booking.barberId));

      return {
        id: Number(review.insertId),
        bookingId: input.bookingId,
        clientId: ctx.user.id,
        barberId: booking.barberId,
        rating: input.rating,
        comment: input.comment,
      };
    }),

  list: publicQuery
    .input(z.object({ barberId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db
        .select()
        .from(reviews)
        .where(eq(reviews.barberId, input.barberId))
        .orderBy(desc(reviews.createdAt));
    }),

  getByBooking: authedQuery
    .input(z.object({ bookingId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const [review] = await db
        .select()
        .from(reviews)
        .where(eq(reviews.bookingId, input.bookingId))
        .limit(1);
      return review ?? null;
    }),
});
