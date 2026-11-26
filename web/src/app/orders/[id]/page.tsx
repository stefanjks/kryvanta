import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDict } from "@/lib/i18n";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatRub } from "@/lib/money";
import { StatusBadge, fmtDate } from "@/components/ui";
import { ActionButton } from "@/components/ActionButton";
import { AutoRefresh } from "./AutoRefresh";

export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect(`/login?next=/orders/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { locale, d } = await getDict();
  const p = await prisma.purchase.findUnique({ where: { id }, include: { product: true, payments: { orderBy: { createdAt: "desc" } }, creatorCode: true } });
  if (!p || (p.userId !== user.id && user.role !== "ADMIN")) notFound();
  const pay = p.payments[0];
  const label: Record<string, string> = { PENDING: d.order.pending, PAID: d.order.paid, CANCELLED: d.order.cancelled, REFUNDED: d.order.refunded, FAILED: d.order.failed };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      {p.status === "PENDING" && <AutoRefresh />}
      <div className={`${p.status === "PAID" ? "card-gold" : "card"} space-y-5 p-8`}>
        <div className="flex items-center justify-between">
          <h1 className="h-title text-3xl text-white">{d.order.title} #{p.orderNumber}</h1>
          <StatusBadge status={p.status} label={label[p.status]} />
        </div>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-mute">{d.order.product}</dt><dd>{locale === "en" ? p.product.nameEn : p.product.nameRu}</dd></div>
          <div className="flex justify-between"><dt className="text-mute">{d.order.recipient}</dt><dd>{p.recipientName}</dd></div>
          {p.creatorCode && <div className="flex justify-between"><dt className="text-mute">{d.store.promo}</dt><dd className="font-mono">{p.creatorCode.code}</dd></div>}
          <div className="flex justify-between"><dt className="text-mute">{d.store.price}</dt><dd>{formatRub(p.basePriceKopecks, locale)}</dd></div>
          {p.discountKopecks > 0 && <div className="flex justify-between text-emerald-400"><dt>{d.store.discount}</dt><dd>−{formatRub(p.discountKopecks, locale)}</dd></div>}
          <div className="flex justify-between border-t border-edge pt-2 text-lg font-bold"><dt>{d.store.total}</dt><dd className="text-gold-soft">{formatRub(p.amountKopecks, locale)}</dd></div>
          <div className="flex justify-between"><dt className="text-mute">{d.common.date}</dt><dd>{fmtDate(p.createdAt, locale)}</dd></div>
        </dl>
        {p.status === "PAID" && <p className="text-emerald-300">{d.order.paidText}</p>}
        {p.status === "PENDING" && (
          <div className="flex flex-wrap gap-3">
            {pay?.confirmationUrl ? <a href={pay.confirmationUrl} className="btn-gold">{d.order.payNow}</a> : <p className="text-sm text-mute">{d.order.manualWait}</p>}
            {p.userId === user.id && <ActionButton endpoint={`/api/orders/${p.id}/cancel`} label={d.order.cancel} className="btn-ghost" />}
          </div>
        )}
      </div>
      <Link href="/account" className="text-sm text-mute hover:text-white">← {d.nav.account}</Link>
    </div>
  );
}
