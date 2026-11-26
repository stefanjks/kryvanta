import { route } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { cancelPendingOrder } from "@/server/orders";

export const POST = route<{ id: string }>(async (_req, { params }) => {
  const u = await requireUser();
  const { id } = await params;
  return cancelPendingOrder(id, u.id, { source: "user" });
});
