import { z } from "zod";
import { pluginRoute } from "@/server/pluginRoute";
import { confirmLink } from "@/server/users";
import { ApiError } from "@/lib/errors";

const schema = z.object({ code: z.string().max(16), uuid: z.uuid(), name: z.string().max(16) });

export const POST = pluginRoute(schema, async (b) => {
  try {
    const r = await confirmLink(b);
    return { ok: true, username: r.username };
  } catch (e) {
    if (e instanceof ApiError) return { ok: false, error: e.code, message: e.message };
    throw e;
  }
});
