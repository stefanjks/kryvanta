import { z } from "zod";
import { route, parseJson } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { createCreator } from "@/server/creators";

const schema = z.object({
  user: z.string().trim().min(1).max(120),
  displayName: z.string().trim().min(2).max(40),
  code: z.string().trim().max(24).nullish(),
  channelUrl: z.url().max(200).nullish(),
  platform: z.enum(["youtube", "tiktok", "twitch"]).nullish(),
  commissionBps: z.number().int().min(0).max(9000).nullish(),
});

/** Добавить блогера вручную (по email / имени на сайте / нику Minecraft). */
export const POST = route(async (req) => {
  const admin = await requireAdmin();
  const b = await parseJson(req, schema);
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: b.user.toLowerCase() }, { username: { equals: b.user, mode: "insensitive" } }, { minecraftAccount: { name: { equals: b.user, mode: "insensitive" } } }] },
  });
  if (!user) throw notFound("user_not_found");
  const r = await prisma.$transaction((tx) =>
    createCreator(tx, {
      userId: user.id, displayName: b.displayName, code: b.code ?? undefined, commissionBps: b.commissionBps ?? null, actorUserId: admin.id,
      socials: b.channelUrl ? { [b.platform ?? "youtube"]: b.channelUrl } : {},
    }),
  );
  return { ok: true, creatorId: r.creator.id, code: r.code };
});
