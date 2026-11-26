import { z } from "zod";
import { pluginRoute } from "@/server/pluginRoute";
import { handleSync } from "@/server/plugin";

const schema = z.object({
  online: z.number().int().min(0),
  max: z.number().int().min(0),
  version: z.string().max(64).optional(),
  players: z.array(z.object({ uuid: z.uuid(), name: z.string().max(16) })).max(2000),
});

export const POST = pluginRoute(schema, handleSync);
