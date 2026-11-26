import { z } from "zod";
import { pluginRoute } from "@/server/pluginRoute";
import { recordRewardClaims } from "@/server/plugin";

const schema = z.object({
  claims: z.array(z.object({
    claimId: z.uuid(),
    uuid: z.uuid(),
    name: z.string().max(16),
    rewardKey: z.string().max(64),
    source: z.enum(["PLAYTIME", "MANUAL", "PURCHASE"]),
    items: z.array(z.object({ material: z.string().max(64), amount: z.number().int().min(1).max(6400) })).max(54),
    claimedAt: z.iso.datetime(),
  })).max(500),
});

export const POST = pluginRoute(schema, async (b) => ({ recorded: await recordRewardClaims(b.claims) }));
