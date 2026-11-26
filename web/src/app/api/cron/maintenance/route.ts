import { NextResponse, type NextRequest } from "next/server";
import { safeEqualHex, sha256 } from "@/lib/crypto";
import { runMaintenance } from "@/server/maintenance";

/**
 * Обслуживание по расписанию для хостингов без cron (Vercel Cron).
 * Vercel сам передаёт заголовок Authorization: Bearer <CRON_SECRET>, если переменная CRON_SECRET задана.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqualHex(sha256(auth), sha256(`Bearer ${secret}`))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await runMaintenance());
}
