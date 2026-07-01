import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { bookings, barbers, services, notifications } from "@db/schema";
import { eq, and, gte, desc, sql } from "drizzle-orm";

export const bookingRouter = createRouter({
  getAvailableSlots: publicQuery
    .input(z.object({ barberId: z.number(), date: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();

      // Get barber's working hours (default 09:00-21:00)
      const workStart = 9;
      const workEnd = 21;
      const slotDuration = 30; // minutes

      // Get existing bookings for this date
      const existingBookings = await db
        .select({
          startTime: bookings.startTime,
          endTime: bookings.endTime,
          status: bookings.status,
        })
        .from(bookings)
        .where(
          and(
            eq(bookings.barberId, input.barberId),
            eq(bookings.bookingDate, new Date(input.date)),
            sql`${bookings.status} IN ('pending', 'confirmed')`
          )
        );

      // Generate all possible slots
      const slots: {
        time: string;
        available: boolean;
      }[] = [];

      for (let hour = workStart; hour < workEnd; hour++) {
        for (let minute = 0; minute < 60; minute += slotDuration) {
          const timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

          // Check if slot is booked
          const isBooked = existingBookings.some((b) => {
            const startStr = b.startTime.toString().slice(0, 5);
            return startStr === timeStr;
          });

          slots.push({
            time: timeStr,
            available: !isBooked,
          });
        }
      }

      return { slots };
    }),

  create: authedQuery
    .input(
      z.object({
        barberId: z.number(),
        serviceId: z.number(),
        date: z.string(),
        time: z.string(),
        notes: z.string().optional(),
        paymentMethod: z
          .enum(["card_online", "cash", "card_in_shop"])
          .optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();

      // Get service info
      const [service] = await db
        .select()
        .from(services)
        .where(eq(services.id, input.serviceId))
        .limit(1);

      if (!service) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Услуга не найдена",
        });
      }

      // Calculate end time
      const [hours, minutes] = input.time.split(":").map(Number);
      const startDate = new Date();
      startDate.setHours(hours, minutes, 0, 0);
      const endDate = new Date(startDate.getTime() + service.duration * 60000);
      const endTime = `${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}`;

      // Create booking
      const [booking] = await db.insert(bookings).values({
        clientId: ctx.user.id,
        barberId: input.barberId,
        serviceId: input.serviceId,
        bookingDate: new Date(input.date),
        startTime: input.time,
        endTime: endTime,
        status: "pending",
        paymentMethod: input.paymentMethod ?? "cash",
        price: service.price,
        notes: input.notes,
      });

      const bookingId = Number(booking.insertId);

      // Create notification for client
      await db.insert(notifications).values({
        userId: ctx.user.id,
        type: "booking",
        title: "Запись создана",
        message: `Вы записались на ${service.name} ${input.date} в ${input.time}`,
        data: { bookingId, type: "booking_created" },
      });

      // Get barber user id for notification
      const [barber] = await db
        .select()
        .from(barbers)
        .where(eq(barbers.id, input.barberId))
        .limit(1);

      if (barber) {
        await db.insert(notifications).values({
          userId: barber.userId,
          type: "booking",
          title: "Новая запись",
          message: `Новая запись на ${service.name} ${input.date} в ${input.time}`,
          data: { bookingId, type: "new_booking" },
        });
      }

      return {
        id: bookingId,
        barberId: input.barberId,
        serviceId: input.serviceId,
        bookingDate: input.date,
        startTime: input.time,
        endTime: endTime,
        status: "pending" as const,
        price: service.price,
        notes: input.notes,
      };
    }),

  list: authedQuery
    .input(
      z
        .object({
          status: z.string().optional(),
          upcoming: z.boolean().optional(),
        })
        .optional()
        .default({})
    )
    .query(async ({ input, ctx }) => {
      const db = getDb();

      let conditions = [eq(bookings.clientId, ctx.user.id)];

      if (input.status) {
        conditions.push(eq(bookings.status, input.status as any));
      }

      if (input.upcoming) {
        conditions.push(
          gte(bookings.bookingDate, new Date(new Date().toDateString()))
        );
      }

      const userBookings = await db
        .select()
        .from(bookings)
        .where(and(...conditions))
        .orderBy(desc(bookings.bookingDate), desc(bookings.startTime));

      // Enrich with barber and service info
      const enriched = await Promise.all(
        userBookings.map(async (booking) => {
          const [barber] = await db
            .select({
              shopName: barbers.shopName,
              userId: barbers.userId,
            })
            .from(barbers)
            .where(eq(barbers.id, booking.barberId))
            .limit(1);

          const [service] = await db
            .select({ name: services.name, duration: services.duration })
            .from(services)
            .where(eq(services.id, booking.serviceId))
            .limit(1);

          return {
            ...booking,
            barberName: barber?.shopName ?? "Мастер",
            serviceName: service?.name ?? "Услуга",
            serviceDuration: service?.duration ?? 0,
          };
        })
      );

      return enriched;
    }),

  getById: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();

      const [booking] = await db
        .select()
        .from(bookings)
        .where(
          and(
            eq(bookings.id, input.id),
            eq(bookings.clientId, ctx.user.id)
          )
        )
        .limit(1);

      if (!booking) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Запись не найдена",
        });
      }

      const [barber] = await db
        .select()
        .from(barbers)
        .where(eq(barbers.id, booking.barberId))
        .limit(1);

      const [service] = await db
        .select()
        .from(services)
        .where(eq(services.id, booking.serviceId))
        .limit(1);

      return { ...booking, barber, service };
    }),

  cancel: authedQuery
    .input(z.object({ id: z.number(), reason: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();

      const [booking] = await db
        .select()
        .from(bookings)
        .where(
          and(
            eq(bookings.id, input.id),
            eq(bookings.clientId, ctx.user.id)
          )
        )
        .limit(1);

      if (!booking) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Запись не найдена",
        });
      }

      await db
        .update(bookings)
        .set({ status: "cancelled" })
        .where(eq(bookings.id, input.id));

      // Notify barber
      const [barber] = await db
        .select()
        .from(barbers)
        .where(eq(barbers.id, booking.barberId))
        .limit(1);

      if (barber) {
        await db.insert(notifications).values({
          userId: barber.userId,
          type: "booking",
          title: "Запись отменена",
          message: `Клиент отменил запись на ${booking.bookingDate}`,
          data: { bookingId: input.id, type: "booking_cancelled" },
        });
      }

      return { ...booking, status: "cancelled" as const };
    }),

  reschedule: authedQuery
    .input(
      z.object({
        id: z.number(),
        newDate: z.string(),
        newTime: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();

      const [booking] = await db
        .select()
        .from(bookings)
        .where(
          and(
            eq(bookings.id, input.id),
            eq(bookings.clientId, ctx.user.id)
          )
        )
        .limit(1);

      if (!booking) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Запись не найдена",
        });
      }

      // Get service duration for end time calculation
      const [service] = await db
        .select({ duration: services.duration })
        .from(services)
        .where(eq(services.id, booking.serviceId))
        .limit(1);

      const duration = service?.duration ?? 30;
      const [hours, minutes] = input.newTime.split(":").map(Number);
      const startDate = new Date();
      startDate.setHours(hours, minutes, 0, 0);
      const endDate = new Date(startDate.getTime() + duration * 60000);
      const endTime = `${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}`;

      await db
        .update(bookings)
        .set({
          bookingDate: new Date(input.newDate),
          startTime: input.newTime,
          endTime: endTime,
          status: "pending",
        })
        .where(eq(bookings.id, input.id));

      return { success: true };
    }),
});
