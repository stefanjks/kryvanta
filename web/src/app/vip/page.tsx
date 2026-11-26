import Link from "next/link";
import { getDict } from "@/lib/i18n";
import { prisma } from "@/lib/db";
import { formatRub } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { ItemIcon, prettyMaterial } from "@/components/ItemIcon";
import { Badge } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "KRYVANTA VIP" };

export default async function VipPage() {
  const { locale, d } = await getDict();
  const [vip, rewards, perms, s] = await Promise.all([
    prisma.product.findFirst({ where: { type: "VIP", active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.vipReward.findMany({ where: { enabled: true, weight: { gt: 0 } }, orderBy: { weight: "desc" } }),
    prisma.vipPermission.findMany({ orderBy: { sortOrder: "asc" } }),
    getSettings(),
  ]);
  const totalWeight = rewards.reduce((a, r) => a + r.weight, 0) || 1;
  const hours = Math.round((s.vip.rewardIntervalSeconds / 3600) * 10) / 10;

  return (
    <div className="space-y-16">
      <section className="grid items-center gap-8 lg:grid-cols-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={vip?.image ?? "/img/vip.svg"} alt="KRYVANTA VIP" className="w-full rounded-3xl border border-gold/30 shadow-[0_0_80px_-30px_rgb(212_175_55/0.7)]" />
        <div className="space-y-5">
          <Badge color="green">{d.vip.badge}</Badge>
          <h1 className="h-title text-5xl"><span className="text-gold">✦ </span><span className="gold-text">{d.vip.title}</span><span className="text-gold"> ✦</span></h1>
          {vip && (
            <div className="text-4xl font-bold text-white">
              {formatRub(vip.priceKopecks, locale)} <span className="text-lg font-normal text-mute">/ {vip.durationDays} {d.common.days}</span>
            </div>
          )}
          <p className="text-zinc-300">{d.vip.intro}</p>
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            {(locale === "en" ? vip?.featuresEn : vip?.featuresRu)?.map((f) => (
              <li key={f} className="flex gap-2"><span className="text-gold">✦</span>{f}</li>
            ))}
          </ul>
          {vip && <Link href={`/checkout/${vip.slug}`} className="btn-gold text-base">{d.vip.buy}</Link>}
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="card p-6">
          <h2 className="h-title text-2xl text-white">{d.vip.sizeTitle} <code className="text-base text-gold-soft">/size</code></h2>
          <p className="mt-2 text-sm text-mute">{d.vip.sizeText}</p>
          <div className="mt-6 flex items-end justify-between gap-2 px-2">
            {s.vip.allowedScales.map((sc) => (
              <div key={sc} className="flex flex-col items-center gap-2">
                <div className="w-5 rounded-t-md bg-gradient-to-t from-gold-deep to-gold-soft" style={{ height: `${sc * 48}px` }} />
                <span className="font-mono text-xs text-zinc-300">{sc.toFixed(2).replace(/0$/, "")}x</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-6">
          <h2 className="h-title text-2xl text-white">{d.vip.boatTitle} <code className="text-base text-gold-soft">/boat</code></h2>
          <p className="mt-2 text-sm text-mute">{d.vip.boatText}</p>
          <div className="mt-6 space-y-2">
            {["I", "II", "III"].map((lvl, i) => (
              <div key={lvl} className="flex items-center gap-3 text-sm">
                <span className="w-10 font-semibold text-gold-soft">{lvl}</span>
                <div className="h-2 flex-1 rounded-full bg-coal">
                  <div className="h-2 rounded-full bg-gradient-to-r from-gold-deep to-gold" style={{ width: `${(s.vip.boatMaxSpeeds[i] / 0.8) * 100}%` }} />
                </div>
                <span className="w-24 text-right font-mono text-xs text-mute">{(s.vip.boatMaxSpeeds[i] * 20).toFixed(0)} {locale === "en" ? "bl/s" : "бл/с"}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <div>
          <h2 className="h-title text-3xl text-white">{d.vip.stationsTitle}</h2>
          <p className="text-sm text-mute">{d.vip.stationsText}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {d.vip.stations.map(([cmd, name, text]) => (
            <div key={cmd} className="card p-4 transition hover:border-gold/50">
              <code className="text-xs text-gold-soft">{cmd}</code>
              <div className="mt-1 font-semibold text-white">{name}</div>
              <p className="mt-1 text-xs text-mute">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card-gold p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="h-title text-3xl text-white">{d.vip.rewardsTitle} <code className="text-base text-gold-soft">/viprewards</code></h2>
            <p className="mt-2 max-w-2xl text-sm text-zinc-300">{d.vip.rewardsText.replace("3", String(hours))}</p>
          </div>
          <Badge color="gold">{hours} {locale === "en" ? "h" : "ч"}</Badge>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {rewards.map((r) => (
            <div key={r.key} className="card p-5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">{locale === "en" ? r.nameEn : r.nameRu}</span>
                <span className="text-xs text-mute">{Math.round((r.weight / totalWeight) * 100)}%</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {(r.items as { material: string; amount: number }[]).map((it) => (
                  <div key={it.material} className="flex flex-col items-center gap-1 rounded-xl bg-coal p-2 text-center" title={prettyMaterial(it.material)}>
                    <ItemIcon material={it.material} size={32} />
                    <span className="text-[11px] leading-tight text-zinc-300">{it.amount}× {prettyMaterial(it.material)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="h-title text-3xl text-white">{d.vip.commandsTitle}</h2>
        <div className="card overflow-x-auto">
          <table className="table">
            <tbody>
              {perms.map((p) => (
                <tr key={p.key} className={p.enabled ? "" : "opacity-40"}>
                  <td className="font-mono text-gold-soft">{(locale === "en" ? p.labelEn : p.labelRu).match(/\(([^)]+)\)/)?.[1]}</td>
                  <td>{(locale === "en" ? p.labelEn : p.labelRu).replace(/\s*\([^)]+\)/, "")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
