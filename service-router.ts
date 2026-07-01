import { z } from "zod";
import { createRouter, publicQuery, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { services, barbers } from "@db/schema";
import { eq, and } from "drizzle-orm";

export const serviceRouter = createRouter({
  list: publicQuery
    .input(z.object({ barberId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db
        .select()
        .from(services)
        .where(
          and(
            eq(services.barberId, input.barberId),
            eq(services.isActive, true)
          )
        );
    }),

  create: authedQuery
    .input(
      z.object({
        barberId: z.number(),
        name: z.string().min(2),
        description: z.string().optional(),
        duration: z.number().min(5),
        price: z.number().min(0),
        category: z.enum([
          "haircut",
          "beard",
          "styling",
          "coloring",
          "shaving",
          "complex",
        ]),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [service] = await db.insert(services).values(input);
      return { id: Number(service.insertId), ...input };
    }),

  update: authedQuery
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(2).optional(),
        description: z.string().optional(),
        duration: z.number().min(5).optional(),
        price: z.number().min(0).optional(),
        category: z
          .enum([
            "haircut",
            "beard",
            "styling",
            "coloring",
            "shaving",
            "complex",
          ])
          .optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;
      await db.update(services).set(data).where(eq(services.id, id));
      const [updated] = await db
        .select()
        .from(services)
        .where(eq(services.id, id))
        .limit(1);
      return updated;
    }),

  delete: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(services).where(eq(services.id, input.id));
      return { success: true };
    }),
});
