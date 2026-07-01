import { authRouter } from "./auth-router";
import { localAuthRouter } from "./local-auth-router";
import { barberRouter } from "./barber-router";
import { bookingRouter } from "./booking-router";
import { serviceRouter } from "./service-router";
import { notificationRouter } from "./notification-router";
import { subscriptionRouter } from "./subscription-router";
import { reviewRouter } from "./review-router";
import { adminRouter } from "./admin-router";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  localAuth: localAuthRouter,
  barber: barberRouter,
  booking: bookingRouter,
  service: serviceRouter,
  notification: notificationRouter,
  subscription: subscriptionRouter,
  review: reviewRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
