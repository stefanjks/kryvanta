import { PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { __kryPrisma?: PrismaClient };

export const prisma: PrismaClient = g.__kryPrisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") g.__kryPrisma = prisma;

export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
