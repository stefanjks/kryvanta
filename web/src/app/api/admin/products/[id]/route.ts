import { route, parseJson } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { notFound } from "@/lib/errors";
import { productSchema } from "@/server/productSchema";

/** Изменение цены/срока/описания. Уже созданные заказы хранят снимок цены и срока и не меняются. */
export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin();
  const { id } = await params;
  const b = await parseJson(req, productSchema.partial());
  const before = await prisma.product.findUnique({ where: { id } });
  if (!before) throw notFound();
  const { payload, durationDays, ...rest } = b;
  // null в необязательных текстовых полях = «не менять»; durationDays: null = разовый товар
  const clean = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== null && v !== undefined));
  const p = await prisma.product.update({
    where: { id },
    data: { ...clean, ...(durationDays !== undefined ? { durationDays } : {}), ...(payload ? { payload: payload as object } : {}) },
  });
  await audit({ actorUserId: admin.id, actorType: "ADMIN", action: "product.update", entityType: "product", entityId: id,
    data: { before: { priceKopecks: before.priceKopecks, durationDays: before.durationDays, active: before.active }, changes: JSON.parse(JSON.stringify(b)) } });
  return { ok: true, product: p };
});
