import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { users } from "@db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "barbo-super-secret-key-2024";

// Generate a unionId from phone
function phoneToUnionId(phone: string): string {
  return `local_${phone.replace(/\D/g, "")}`;
}

function generateTokens(userId: number, role: string) {
  const accessToken = jwt.sign({ userId, role }, JWT_SECRET, {
    expiresIn: "15m",
  });
  const refreshToken = jwt.sign({ userId, role }, JWT_SECRET, {
    expiresIn: "7d",
  });
  return { accessToken, refreshToken };
}

export const localAuthRouter = createRouter({
  register: publicQuery
    .input(
      z.object({
        phone: z
          .string()
          .min(10)
          .regex(/^\+?7\s?\d{3}\s?\d{3}\s?\d{2}\s?\d{2}$/, {
            message: "Формат: +7 7XX XXX XX XX",
          }),
        password: z.string().min(6, "Минимум 6 символов"),
        name: z.string().min(2, "Минимум 2 символа"),
        role: z.enum(["client", "barber", "owner"]).optional().default("client"),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const unionId = phoneToUnionId(input.phone);

      // Check if user exists
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.phone, input.phone))
        .limit(1);

      if (existing.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Пользователь с таким номером уже существует",
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(input.password, 12);

      // Create user
      const [user] = await db.insert(users).values({
        unionId,
        phone: input.phone,
        password: hashedPassword,
        name: input.name,
        role: input.role,
      });

      const { accessToken, refreshToken } = generateTokens(
        Number(user.insertId),
        input.role
      );

      return {
        token: accessToken,
        refreshToken,
        user: {
          id: Number(user.insertId),
          name: input.name,
          phone: input.phone,
          role: input.role,
        },
      };
    }),

  login: publicQuery
    .input(
      z.object({
        phone: z.string().min(10),
        password: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.phone, input.phone))
        .limit(1);

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Неверный номер телефона или пароль",
        });
      }

      const isValid = await bcrypt.compare(input.password, user.password);
      if (!isValid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Неверный номер телефона или пароль",
        });
      }

      // Update last sign in
      await db
        .update(users)
        .set({ lastSignInAt: new Date() })
        .where(eq(users.id, user.id));

      const { accessToken, refreshToken } = generateTokens(user.id, user.role);

      return {
        token: accessToken,
        refreshToken,
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          role: user.role,
          avatar: user.avatar,
        },
      };
    }),

  me: publicQuery.query(async ({ ctx }) => {
    const authHeader = ctx.req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return null;
    }

    const token = authHeader.slice(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as {
        userId: number;
        role: string;
      };
      const db = getDb();
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, decoded.userId))
        .limit(1);

      if (!user) return null;

      return {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
        pushEnabled: user.pushEnabled,
      };
    } catch {
      return null;
    }
  }),

  refresh: publicQuery
    .input(z.object({ refreshToken: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const decoded = jwt.verify(input.refreshToken, JWT_SECRET) as {
          userId: number;
          role: string;
        };
        const { accessToken, refreshToken } = generateTokens(
          decoded.userId,
          decoded.role
        );
        return { token: accessToken, refreshToken };
      } catch {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid refresh token",
        });
      }
    }),

  updateProfile: publicQuery
    .input(
      z.object({
        name: z.string().min(2).optional(),
        email: z.string().email().optional(),
        avatar: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const authHeader = ctx.req.headers.get("authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Not logged in" });
      }

      const token = authHeader.slice(7);
      const decoded = jwt.verify(token, JWT_SECRET) as {
        userId: number;
      };

      const db = getDb();
      const updateData: Record<string, unknown> = {};
      if (input.name) updateData.name = input.name;
      if (input.email) updateData.email = input.email;
      if (input.avatar) updateData.avatar = input.avatar;

      await db.update(users).set(updateData).where(eq(users.id, decoded.userId));

      const [updated] = await db
        .select()
        .from(users)
        .where(eq(users.id, decoded.userId))
        .limit(1);

      return updated;
    }),

  changePassword: publicQuery
    .input(
      z.object({
        oldPassword: z.string(),
        newPassword: z.string().min(6),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const authHeader = ctx.req.headers.get("authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Not logged in" });
      }

      const token = authHeader.slice(7);
      const decoded = jwt.verify(token, JWT_SECRET) as {
        userId: number;
      };

      const db = getDb();
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, decoded.userId))
        .limit(1);

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      const isValid = await bcrypt.compare(input.oldPassword, user.password);
      if (!isValid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Неверный текущий пароль",
        });
      }

      const hashedPassword = await bcrypt.hash(input.newPassword, 12);
      await db
        .update(users)
        .set({ password: hashedPassword })
        .where(eq(users.id, decoded.userId));

      return { success: true };
    }),
});
