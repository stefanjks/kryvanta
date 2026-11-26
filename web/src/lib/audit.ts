import type { Prisma } from "@prisma/client";
import { prisma, type Tx } from "./db";

export type AuditInput = {
  actorUserId?: string | null;
  actorType: "USER" | "ADMIN" | "SYSTEM" | "PLUGIN" | "PAYMENT";
  action: string;
  entityType?: string;
  entityId?: string;
  data?: Prisma.InputJsonValue;
  ipHash?: string;
};

export async function audit(input: AuditInput, tx: Tx = prisma) {
  await tx.auditLog.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      actorType: input.actorType,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      data: input.data,
      ipHash: input.ipHash,
    },
  });
}
