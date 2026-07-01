import { relations } from "drizzle-orm";
import {
  users,
  barbers,
  services,
  bookings,
  reviews,
  notifications,
  subscriptions,
  favorites,
} from "./schema";

export const usersRelations = relations(users, ({ many, one }) => ({
  barberProfile: one(barbers, {
    fields: [users.id],
    references: [barbers.userId],
  }),
  bookings: many(bookings),
  reviews: many(reviews),
  notifications: many(notifications),
  subscriptions: many(subscriptions),
  favorites: many(favorites),
}));

export const barbersRelations = relations(barbers, ({ one, many }) => ({
  user: one(users, {
    fields: [barbers.userId],
    references: [users.id],
  }),
  services: many(services),
  bookings: many(bookings),
  reviews: many(reviews),
  favorites: many(favorites),
}));

export const servicesRelations = relations(services, ({ one, many }) => ({
  barber: one(barbers, {
    fields: [services.barberId],
    references: [barbers.id],
  }),
  bookings: many(bookings),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  client: one(users, {
    fields: [bookings.clientId],
    references: [users.id],
  }),
  barber: one(barbers, {
    fields: [bookings.barberId],
    references: [barbers.id],
  }),
  service: one(services, {
    fields: [bookings.serviceId],
    references: [services.id],
  }),
  reviews: many(reviews),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  booking: one(bookings, {
    fields: [reviews.bookingId],
    references: [bookings.id],
  }),
  client: one(users, {
    fields: [reviews.clientId],
    references: [users.id],
  }),
  barber: one(barbers, {
    fields: [reviews.barberId],
    references: [barbers.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
}));

export const favoritesRelations = relations(favorites, ({ one }) => ({
  user: one(users, {
    fields: [favorites.userId],
    references: [users.id],
  }),
  barber: one(barbers, {
    fields: [favorites.barberId],
    references: [barbers.id],
  }),
}));
