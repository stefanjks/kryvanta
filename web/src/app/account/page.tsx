import Link from "next/link";
import { redirect } from "next/navigation";
import { getDict } from "@/lib/i18n";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatRub } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { Section, StatusBadge, Empty, fmtDate, fmtDuration, Badge } from "@/components/ui";
import { ActionButton } from "@/components/ActionButton";
import { LinkCode } from "./LinkCode";

export const dynamic = "force-dynamic";
export const metadata = { title: "Личный кабинет" };

export default async function Account() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/account");
  const { locale, d } = await getDict();
  const [account, purchases, notifications, products, s, creator] = await Promise.all([
    prisma.minecraftAccount.findUnique({ where: { userId: user.id }, include: { subscriptions: true } }),
    prisma.purchase.findMany({ where: { userId: user.id }, include: { product: true, creatorCode: true }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 15 }),
    prisma.product.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    getSettings(),
    prisma.creator.findUnique({ where: { userId: user.id } }),
  ]);
  const sub = account?.subscriptions[0];
  const vipActive = sub && sub.status === "ACTIVE" && sub.expiresAt > new Date();
  const progress = account ? Math.min(1, account.rewardProgressSeconds / s.vip.rewardIntervalSeconds) : 0;
  const left = account ? Math.max(0, s.vip.rewardIntervalSeconds - account.rewardProgressSeconds) : 0;
  const promos = purchases.filter((p) => p.creatorCode && p.status === "PAID");
  const statusLabel: Record<string, string> = { PENDING: d.order.pending, PAID: d.order.paid, CANCELLED: d.order.cancelled, REFUNDED: d.order.refunded, FAILED: d.order.failed };
  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h-title text-4xl gold-text">{d.account.title}</h1>
          <p className="text-mute">{user.username} · {user.email}</p>
        </div>
        {!creator && <Link href="/creator" className="btn-ghost">{d.account.creatorCta}</Link>}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card space-y-4 p-6">
          <div className="text-xs uppercase tracking-wider text-mute">{d.account.minecraft}</div>
          {account ? (
            <>
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`https://mc-heads.net/avatar/${account.uuid}/48`} alt="" width={48} height={48} className="rounded-lg" />
                <div>
                  <div className="text-xl font-bold text-white">{account.name}</div>
                  <Badge color="green">{d.account.linked}</Badge>
                </div>
              </div>
              <div className="text-sm text-mute">{d.account.playtime}: <span className="text-white">{fmtDuration(account.activePlaytimeSeconds, locale)}</span></div>
            </>
          ) : (
            <>
              <div className="text-lg text-white">{d.account.notLinked}</div>
              <LinkCode t={d.account} />
            </>
          )}
        </div>

        <div className={`${vipActive ? "card-gold" : "card"} space-y-4 p-6`}>
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-mute">{d.account.vip}</span>
            {vipActive && <Badge color="green">VIP</Badge>}
          </div>
          {vipActive ? (
            <div>
              <div className="h-title text-2xl gold-text">KRYVANTA VIP</div>
              <div className="text-sm text-zinc-300">{d.account.vipActive} <b>{fmtDate(sub!.expiresAt, locale)}</b></div>
            </div>
          ) : (
            <div className="text-lg text-white">{d.account.vipNone}</div>
          )}
          <Link href="/checkout/kryvanta-vip" className="btn-gold">{vipActive ? d.account.extend : d.vip.buy}</Link>
        </div>

        <div className="card space-y-4 p-6">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-mute">{d.vip.rewardsTitle}</span>
            {account && account.rewardsStored > 0 && <Badge color="gold">×{account.rewardsStored}</Badge>}
          </div>
          {vipActive && account ? (
            <>
              <div className="font-mono text-3xl font-bold text-white">{fmtDuration(left, locale)}</div>
              <div className="h-2.5 rounded-full bg-coal"><div className="h-2.5 rounded-full bg-gradient-to-r from-gold-deep to-gold" style={{ width: `${progress * 100}%` }} /></div>
              <p className="text-xs text-mute">{fmtDuration(account.rewardProgressSeconds, locale)} / {fmtDuration(s.vip.rewardIntervalSeconds, locale)} · /viprewards</p>
            </>
          ) : (
            <p className="text-sm text-mute">{d.vip.rewardsText}</p>
          )}
        </div>
      </div>

      <Section title={d.account.notifications} action={unread > 0 ? <ActionButton endpoint="/api/notifications/read" label="✓" /> : undefined}>
        {notifications.length === 0 ? <Empty>{d.common.empty}</Empty> : (
          <div className="grid gap-2">
            {notifications.map((n) => (
              <div key={n.id} className={`card flex justify-between gap-4 p-4 ${n.readAt ? "opacity-60" : ""}`}>
                <div><div className="font-semibold text-white">{n.title}</div><div className="text-sm text-mute">{n.body}</div></div>
                <div className="shrink-0 text-xs text-mute">{fmtDate(n.createdAt, locale)}</div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title={d.account.purchases}>
        {purchases.length === 0 ? <Empty>{d.common.empty}</Empty> : (
          <div className="card overflow-x-auto">
            <table className="table">
              <thead><tr><th>#</th><th>{d.order.product}</th><th>{d.order.recipient}</th><th>{d.common.amount}</th><th>{d.common.status}</th><th>{d.common.date}</th></tr></thead>
              <tbody>
                {purchases.map((p) => (
                  <tr key={p.id}>
                    <td><Link className="text-gold-soft hover:underline" href={`/orders/${p.id}`}>#{p.orderNumber}</Link></td>
                    <td>{locale === "en" ? p.product.nameEn : p.product.nameRu}</td>
                    <td>{p.recipientName}</td>
                    <td>{formatRub(p.amountKopecks, locale)}{p.discountKopecks > 0 && <span className="ml-1 text-xs text-emerald-400">−{formatRub(p.discountKopecks, locale)}</span>}</td>
                    <td><StatusBadge status={p.status} label={statusLabel[p.status]} /></td>
                    <td className="text-mute">{fmtDate(p.createdAt, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title={d.account.promos}>
        {promos.length === 0 ? <Empty>{d.common.empty}</Empty> : (
          <div className="flex flex-wrap gap-2">
            {promos.map((p) => <span key={p.id} className="chip border-gold/40 bg-gold/10 font-mono text-gold-soft">{p.creatorCode!.code} · #{p.orderNumber} · −{formatRub(p.discountKopecks, locale)}</span>)}
          </div>
        )}
      </Section>

      <Section title={d.account.products}>
        <div className="grid gap-4 md:grid-cols-3">
          {products.map((p) => (
            <Link key={p.id} href={`/checkout/${p.slug}`} className="card flex items-center justify-between gap-3 p-4 hover:border-gold/50">
              <span className="font-semibold text-white">{locale === "en" ? p.nameEn : p.nameRu}</span>
              <span className="text-gold-soft">{formatRub(p.priceKopecks, locale)}</span>
            </Link>
          ))}
        </div>
      </Section>
    </div>
  );
}
