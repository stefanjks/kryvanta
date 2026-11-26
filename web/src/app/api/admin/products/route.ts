import { z } from "zod";
import { route, parseJson } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { conflict } from "@/lib/errors";
import { productSchema } from "@/server/productSchema";



export const POST = route(async (req) => {
  const admin = await requireAdmin();
  const b = await parseJson(req, productSchema);
  if (await prisma.product.findUnique({ where: { slug: b.slug } })) throw conflict("slug_taken", "Такой slug уже есть");
  const p = await prisma.product.create({
    data: {
      ...b, descriptionRu: b.descriptionRu ?? "", descriptionEn: b.descriptionEn ?? "", image: b.image ?? "/img/vip.svg",
      payload: (b.payload ?? {}) as object, featuresRu: b.featuresRu ?? [], featuresEn: b.featuresEn ?? [], sortOrder: b.sortOrder ?? 0,
      durationDays: b.durationDays ?? null,
    },
  });
  await audit({ actorUserId: admin.id, actorType: "ADMIN", action: "product.create", entityType: "product", entityId: p.id, data: { slug: p.slug, priceKopecks: p.priceKopecks } });
  return { ok: true, id: p.id };
});
