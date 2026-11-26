import { z } from "zod";
import { pluginRoute } from "@/server/pluginRoute";
import { ackDeliveries } from "@/server/plugin";

export const POST = pluginRoute(z.object({ ids: z.array(z.uuid()).max(500) }), async (b) => ({ acknowledged: await ackDeliveries(b.ids) }));
