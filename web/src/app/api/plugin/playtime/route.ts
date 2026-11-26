import { z } from "zod";
import { pluginRoute } from "@/server/pluginRoute";
import { recordPlaytime } from "@/server/plugin";

const schema = z.object({
  batchId: z.uuid(),
  entries: z.array(z.object({
    uuid: z.uuid(),
    name: z.string().max(16),
    activeSeconds: z.number().int().min(0),
    rewardProgressSeconds: z.number().int().min(0).optional(),
    rewardsStored: z.number().int().min(0).optional(),
  })).max(2000),
});

export const POST = pluginRoute(schema, (b) => recordPlaytime(b.batchId, b.entries));
