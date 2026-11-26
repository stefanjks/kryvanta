import { PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { __kryPrisma?: PrismaClient };

/**
 * Интеграция Neon в Vercel задаёт DATABASE_URL (через пулер) и DATABASE_URL_UNPOOLED (прямое подключение).
 * Используем прямое подключение, если оно есть: с ним одинаково надёжно работают и миграции, и транзакции.
 */
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

export const prisma: PrismaClient = g.__kryPrisma ?? new PrismaClient(url ? { datasourceUrl: url } : undefined);
if (process.env.NODE_ENV !== "production") g.__kryPrisma = prisma;

export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
