import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  timestamp,
  int,
  decimal,
  boolean,
  json,
  bigint,
  date,
  time,
} from "drizzle-orm/mysql-core";

// ===================== USERS =====================
export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  phone: varchar("phone", { length: 20 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["client", "barber", "owner", "admin"])
    .default("client")
    .notNull(),
  pushEnabled: boolean("pushEnabled").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ===================== BARBERS =====================
export const barbers = mysqlTable("barbers", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true })
    .notNull()
    .references(() => users.id),
  shopName: varchar("shopName", { length: 200 }).notNull(),
  specialty: json("specialty").$type<string[]>().notNull(),
  experience: int("experience"),
  bio: text("bio"),
  portfolio: json("portfolio").$type<string[]>(),
  rating: decimal("rating", { precision: 2, scale: 1 }).default("5.0"),
  reviewCount: int("reviewCount").default(0),
  priceRange: varchar("priceRange", { length: 50 }),
  address: varchar("address", { length: 300 }),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  isActive: boolean("isActive").default(true),
  subscriptionTier: mysqlEnum("subscriptionTier", ["free", "pro", "business"])
    .default("free")
    .notNull(),
  subscriptionExpiry: timestamp("subscriptionExpiry"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Barber = typeof barbers.$inferSelect;
export type InsertBarber = typeof barbers.$inferInsert;

// ===================== SERVICES =====================
export const services = mysqlTable("services", {
  id: serial("id").primaryKey(),
  barberId: bigint("barberId", { mode: "number", unsigned: true })
    .notNull()
    .references(() => barbers.id),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  duration: int("duration").notNull(),
  price: int("price").notNull(),
  category: mysqlEnum("category", [
    "haircut",
    "beard",
    "styling",
    "coloring",
    "shaving",
    "complex",
  ]).notNull(),
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Service = typeof services.$inferSelect;
export type InsertService = typeof services.$inferInsert;

// ===================== BOOKINGS =====================
export const bookings = mysqlTable("bookings", {
  id: serial("id").primaryKey(),
  clientId: bigint("clientId", { mode: "number", unsigned: true })
    .notNull()
    .references(() => users.id),
  barberId: bigint("barberId", { mode: "number", unsigned: true })
    .notNull()
    .references(() => barbers.id),
  serviceId: bigint("serviceId", { mode: "number", unsigned: true })
    .notNull()
    .references(() => services.id),
  bookingDate: date("bookingDate").notNull(),
  startTime: time("startTime").notNull(),
  endTime: time("endTime").notNull(),
  status: mysqlEnum("status", [
    "pending",
    "confirmed",
    "completed",
    "cancelled",
    "no_show",
  ])
    .default("pending")
    .notNull(),
  paymentMethod: mysqlEnum("paymentMethod", [
    "card_online",
    "cash",
    "card_in_shop",
  ]),
  paymentStatus: mysqlEnum("paymentStatus", ["pending", "paid", "refunded"])
    .default("pending")
    .notNull(),
  notes: text("notes"),
  price: int("price").notNull(),
  reminderSent: boolean("reminderSent").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = typeof bookings.$inferInsert;

// ===================== REVIEWS =====================
export const reviews = mysqlTable("reviews", {
  id: serial("id").primaryKey(),
  bookingId: bigint("bookingId", { mode: "number", unsigned: true })
    .notNull()
    .references(() => bookings.id),
  clientId: bigint("clientId", { mode: "number", unsigned: true })
    .notNull()
    .references(() => users.id),
  barberId: bigint("barberId", { mode: "number", unsigned: true })
    .notNull()
    .references(() => barbers.id),
  rating: int("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Review = typeof reviews.$inferSelect;
export type InsertReview = typeof reviews.$inferInsert;

// ===================== NOTIFICATIONS =====================
export const notifications = mysqlTable("notifications", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true })
    .notNull()
    .references(() => users.id),
  type: mysqlEnum("type", ["booking", "reminder", "promo", "system"])
    .notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  message: text("message").notNull(),
  isRead: boolean("isRead").default(false),
  data: json("data"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// ===================== SUBSCRIPTIONS =====================
export const subscriptions = mysqlTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true })
    .notNull()
    .references(() => users.id),
  tier: mysqlEnum("tier", ["free", "pro", "business"]).notNull(),
  status: mysqlEnum("status", ["active", "expired", "cancelled"])
    .default("active")
    .notNull(),
  startedAt: timestamp("startedAt").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  price: int("price").notNull(),
  paymentMethod: varchar("paymentMethod", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

// ===================== FAVORITES =====================
export const favorites = mysqlTable("favorites", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true })
    .notNull()
    .references(() => users.id),
  barberId: bigint("barberId", { mode: "number", unsigned: true })
    .notNull()
    .references(() => barbers.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Favorite = typeof favorites.$inferSelect;
export type InsertFavorite = typeof favorites.$inferInsert;
