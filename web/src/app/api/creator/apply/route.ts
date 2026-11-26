import { z } from "zod";
import { route, parseJson } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { submitApplication } from "@/server/creators";

const schema = z.object({
  displayName: z.string().trim().min(2).max(40),
  platform: z.enum(["youtube", "tiktok", "twitch"]),
  channelUrl: z.url().max(200).refine((u) => /^https:\/\//.test(u), "Ссылка должна начинаться с https://"),
  audience: z.number().int().min(0).max(1_000_000_000),
  message: z.string().max(1000).nullish(),
});

export const POST = route(async (req) => {
  const u = await requireUser();
  const b = await parseJson(req, schema);
  const app = await submitApplication(u.id, { ...b, message: b.message ?? "" });
  return { ok: true, id: app.id };
}, { rate: { key: "creator-apply", limit: 3, windowMs: 3600_000 } });
