import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { barbers, services, reviews, favorites, users } from "@db/schema";
import { eq, like, and, sql, desc, count } from "drizzle-orm";

export const barberRouter = createRouter({
  list: publicQuery
    .input(
      z
        .object({
          category: z.string().optional(),
          search: z.string().optional(),
          sort: z.enum(["rating", "price_asc", "price_desc", "newest"]).optional(),
          page: z.number().min(1).optional().default(1),
          limit: z.number().min(1).max(50).optional().default(10),
        })
        .optional()
        .default({})
    )
    .query(async ({ input }) => {
      const db = getDb();
      const offset = (input.page - 1) * input.limit;

      let query = db.select().from(barbers).where(eq(barbers.isActive, true));

      if (input.search) {
        query = db
          .select()
          .from(barbers)
          .where(
            and(
              eq(barbers.isActive, true),
              like(barbers.shopName, `%${input.search}%`)
            )
          );
      }

      const allBarbers = await query.limit(input.limit).offset(offset);

      // Get services for each barber
      const result = await Promise.all(
        allBarbers.map(async (barber) => {
          const barberServices = await db
            .select()
            .from(services)
            .where(
              and(
                eq(services.barberId, barber.id),
                eq(services.isActive, true)
              )
            );
          return { ...barber, services: barberServices };
        })
      );

      const [totalCount] = await db
        .select({ count: count() })
        .from(barbers)
        .where(eq(barbers.isActive, true));

      return {
        barbers: result,
        total: totalCount?.count ?? 0,
        page: input.page,
        totalPages: Math.ceil((totalCount?.count ?? 0) / input.limit),
      };
    }),

  getById: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();

      const [barber] = await db
        .select()
        .from(barbers)
        .where(eq(barbers.id, input.id))
        .limit(1);

      if (!barber) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Мастер не найден",
        });
      }

      const barberServices = await db
        .select()
        .from(services)
        .where(eq(services.barberId, input.id));

      const barberReviews = await db
        .select()
        .from(reviews)
        .where(eq(reviews.barberId, input.id))
        .orderBy(desc(reviews.createdAt))
        .limit(10);

      // Get reviewer names
      const reviewsWithNames = await Promise.all(
        barberReviews.map(async (review) => {
          const [client] = await db
            .select({ name: users.name, avatar: users.avatar })
            .from(users)
            .where(eq(users.id, review.clientId))
            .limit(1);
          return { ...review, clientName: client?.name ?? "Клиент", clientAvatar: client?.avatar };
        })
      );

      return {
        ...barber,
        services: barberServices,
        reviews: reviewsWithNames,
      };
    }),

  create: authedQuery
    .input(
      z.object({
        shopName: z.string().min(2),
        specialty: z.array(z.string()),
        bio: z.string().optional(),
        experience: z.number().optional(),
        priceRange: z.string().optional(),
        address: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();

      const [barber] = await db.insert(barbers).values({
        userId: ctx.user.id,
        shopName: input.shopName,
        specialty: input.specialty,
        bio: input.bio,
        experience: input.experience,
        priceRange: input.priceRange,
        address: input.address,
      });

      // Update user role to barber
      await db
        .update(users)
        .set({ role: "barber" })
        .where(eq(users.id, ctx.user.id));

      return { id: Number(barber.insertId), ...input, userId: ctx.user.id };
    }),

  toggleFavorite: authedQuery
    .input(z.object({ barberId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();

      const existing = await db
        .select()
        .from(favorites)
        .where(
          and(
            eq(favorites.userId, ctx.user.id),
            eq(favorites.barberId, input.barberId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await db.delete(favorites).where(eq(favorites.id, existing[0].id));
        return { isFavorited: false };
      } else {
        await db.insert(favorites).values({
          userId: ctx.user.id,
          barberId: input.barberId,
        });
        return { isFavorited: true };
      }
    }),

  getFavorites: authedQuery.query(async ({ ctx }) => {
    const db = getDb();

    const userFavorites = await db
      .select()
      .from(favorites)
      .where(eq(favorites.userId, ctx.user.id));

    const result = await Promise.all(
      userFavorites.map(async (fav) => {
        const [barber] = await db
          .select()
          .from(barbers)
          .where(eq(barbers.id, fav.barberId))
          .limit(1);
        return barber;
      })
    );

    return result.filter(Boolean);
  }),
});
