import { route } from "@/lib/http";
import { serverStatus } from "@/server/status";

export const GET = route(async () => serverStatus());
