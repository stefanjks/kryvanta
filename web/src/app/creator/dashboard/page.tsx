import { redirect } from "next/navigation";
import Link from "next/link";
import { getDict } from "@/lib/i18n";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { formatRub } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { creatorDashboard } from "@/server/creatorStats";
import { Section, Stat, StatusBadge, Empty, fmtDate, Badge } from "@/components/ui";
import { CopyButton } from "@/components/CopyButton";
import { RubChart, CountChart } from "@/components/Charts";
import { ApiForm } from "@/components/ApiForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Кабинет блогера" };

const tierColor = { BRONZE: "text-amber-600", SILVER: "text-zinc-300", GOLD: "text-gold", DIAMOND: "text-cyan-300" } as const;

export default async function CreatorDashboard() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/creator/dashboard");
  const { locale, d } = await getDict();
  const creator = await prisma.creator.findUnique({ where: { userId: user.id } });
  if (!creator) redirect("/creator");
  const [data, s] = await Promise.all([creatorDashboard(creator.id), getSettings()]);
  const code = data.creator.codes.find((c) => c.active) ?? data.creator.codes[0];
  const link = code ? `${env.appUrl}/r/${code.code}` : "";
  const socials = Object.entries((data.creator.socials ?? {}) as Record<string, string>);
  const open = data.payouts.some((p) => p.status === "PENDING" || p.status === "APPROVED");
  const tl = d.common.table;

  return (
    <div className="space-y-10">
      {creator.status !== "APPROVED" && <div className="card border-red-500/40 p-4 text-red-300">{d.dash.blocked}</div>}

      <section className="card-gold flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={data.creator.avatarUrl || "/img/emblem.svg"} alt="" className="h-16 w-16 rounded-2xl border border-gold/40 object-cover" />
          <div>
            <h1 className="h-title text-3xl text-white">{data.creator.displayName}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
              <span className={`h-title ${tierColor[data.creator.tier]}`}>◆ {data.creator.tier}</span>
              {socials.map(([k, v]) => <a key={k} href={v} target="_blank" rel="noopener noreferrer nofollow" className="chip border-edge text-mute hover:text-white">{k}</a>)}
            </div>
          </div>
        </div>
        {code && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase text-mute">{d.dash.code}</span>
              <code className="rounded-lg bg-black/50 px-3 py-1 font-mono text-lg text-gold-soft">{code.code}</code>
              <CopyButton value={code.code} label={d.common.copy} copiedLabel={d.common.copied} className="btn-ghost !px-3 !py-1" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase text-mute">{d.dash.link}</span>
              <code className="max-w-[16rem] truncate rounded-lg bg-black/50 px-3 py-1 font-mono text-xs text-zinc-200">{link}</code>
              <CopyButton value={link} label={d.common.copy} copiedLabel={d.common.copied} className="btn-ghost !px-3 !py-1" />
            </div>
          </div>
        )}
      </section>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Stat label={d.dash.clicks} value={data.totals.clicks} />
        <Stat label={d.dash.invited} value={data.totals.invited} />
        <Stat label={d.dash.active} value={data.totals.active} />
        <Stat label={d.dash.purchases} value={data.totals.purchases} />
        <Stat label={d.dash.sales} value={formatRub(data.totals.salesKopecks, locale)} />
      </section>
      <section className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Stat label={d.dash.earned} value={formatRub(data.balance.earnedTotal, locale)} />
        <Stat gold label={d.dash.available} value={formatRub(Math.max(0, data.balance.available), locale)} />
        <Stat label={d.dash.hold} value={formatRub(data.balance.hold, locale)} />
        <Stat label={d.dash.pendingPayouts} value={formatRub(data.balance.pendingPayouts, locale)} />
        <Stat label={d.dash.paid} value={formatRub(data.balance.paid, locale)} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5"><RubChart title={d.dash.sales7} data={data.charts.sales7} tableLabel={tl} /></div>
        <div className="card p-5"><RubChart title={d.dash.sales30} data={data.charts.sales30} tableLabel={tl} /></div>
        <div className="card p-5"><CountChart title={d.dash.invitedChart} data={data.charts.invited30} tableLabel={tl} /></div>
        <div className="card p-5"><RubChart title={d.dash.incomeMonthly} data={data.charts.incomeMonthly} tableLabel={tl} /></div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <Section title={d.dash.ops}>
          {data.commissions.length === 0 ? <Empty>{d.common.empty}</Empty> : (
            <div className="card overflow-x-auto">
              <table className="table">
                <thead><tr><th>{d.common.date}</th><th>{d.common.details}</th><th>{d.common.amount}</th><th>{d.common.status}</th></tr></thead>
                <tbody>
                  {data.commissions.map((c) => (
                    <tr key={c.id}>
                      <td className="text-mute">{fmtDate(c.createdAt, locale)}</td>
                      <td>{d.dash.types[c.type]}{c.purchase ? ` #${c.purchase.orderNumber}` : ""}{c.rateBps ? <span className="text-xs text-mute"> · {c.rateBps / 100}% × {formatRub(c.baseKopecks ?? 0, locale)}</span> : null}{c.note ? <span className="text-xs text-mute"> · {c.note}</span> : null}</td>
                      <td className={c.amountKopecks < 0 ? "text-red-300" : "text-white"}>{formatRub(c.amountKopecks, locale)}</td>
                      <td><StatusBadge status={c.status === "HOLD" && c.availableAt <= new Date() ? "AVAILABLE" : c.status} label={d.dash.statuses[c.status === "HOLD" && c.availableAt <= new Date() ? "AVAILABLE" : c.status]} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <div className="space-y-8">
          <Section title={d.dash.requestPayout} subtitle={`${d.dash.minPayout}: ${formatRub(s.minPayoutKopecks, locale)}`}>
            <div className="card p-5">
              {open ? (
                <Badge color="gold">{d.dash.statuses.PENDING}</Badge>
              ) : (
                <ApiForm
                  endpoint="/api/creator/payouts"
                  submitLabel={d.dash.requestPayout}
                  resetOnSuccess
                  fields={[
                    { name: "amountKopecks", label: d.dash.payoutAmount, type: "money", required: true, defaultValue: data.balance.available > 0 ? (data.balance.available / 100).toFixed(2) : "" },
                    { name: "method", label: d.dash.payoutMethod, type: "select", options: [{ value: "card", label: "Банковская карта" }, { value: "sbp", label: "СБП" }, { value: "yoomoney", label: "ЮMoney" }, { value: "other", label: "Другое" }] },
                    { name: "details", label: d.dash.payoutDetails, type: "text", required: true },
                  ]}
                />
              )}
            </div>
          </Section>
          <Section title={d.dash.payouts}>
            {data.payouts.length === 0 ? <Empty>{d.common.empty}</Empty> : (
              <div className="space-y-2">
                {data.payouts.map((p) => (
                  <div key={p.id} className="card flex items-center justify-between gap-3 p-4">
                    <div>
                      <div className="font-semibold text-white">{formatRub(p.paidAmountKopecks ?? p.amountKopecks, locale)}</div>
                      <div className="text-xs text-mute">{fmtDate(p.createdAt, locale)}{p.adminComment ? ` · ${p.adminComment}` : ""}</div>
                    </div>
                    <StatusBadge status={p.status} label={d.dash.statuses[p.status]} />
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>
      <Link href="/creator" className="text-sm text-mute hover:text-white">{d.nav.creators}</Link>
    </div>
  );
}
