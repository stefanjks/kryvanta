import Link from "next/link";
import { getDict } from "@/lib/i18n";
import { publicConfig } from "@/lib/env";
import { prisma } from "@/lib/db";
import { formatRub } from "@/lib/money";
import { serverStatus } from "@/server/status";
import { CopyButton } from "@/components/CopyButton";
import { ConnectDialog } from "@/components/ConnectDialog";
import { Emblem } from "@/components/Logo";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { locale, d } = await getDict();
  const [st, vip] = await Promise.all([serverStatus(), prisma.product.findFirst({ where: { type: "VIP", active: true }, orderBy: { sortOrder: "asc" } })]);

  return (
    <div className="space-y-20">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-3xl border border-edge bg-gradient-to-br from-coal via-ink to-black p-8 md:p-14">
        <div className="pointer-events-none absolute -right-20 -top-20 h-96 w-96 rounded-full bg-gold/10 blur-3xl" />
        <div className="grid items-center gap-10 md:grid-cols-[1.3fr_1fr]">
          <div className="animate-fade-up space-y-6">
            <span className="chip border-gold/40 bg-gold/10 text-gold-soft">Minecraft Java {publicConfig.mcVersion}</span>
            <h1 className="h-title text-5xl leading-tight md:text-7xl">
              <span className="text-gold">✦ </span><span className="gold-text">KRYVANTA</span><span className="text-gold"> ✦</span>
            </h1>
            <p className="text-xl font-semibold text-white">{d.home.tagline}</p>
            <p className="max-w-xl text-mute">{d.home.subtitle}</p>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-xl border border-edge bg-black/50 py-1.5 pl-4 pr-1.5">
                <span className="text-xs uppercase tracking-wider text-mute">{d.home.ip}</span>
                <code className="font-mono text-sm text-gold-soft">{publicConfig.serverIp}</code>
                <CopyButton value={publicConfig.serverIp} label={d.common.copy} copiedLabel={d.common.copied} className="btn-ghost !px-3 !py-1.5" />
              </div>
              <ConnectDialog ip={publicConfig.serverIp} version={publicConfig.mcVersion} title={d.home.connect} steps={d.home.connectSteps} play={d.home.play} />
              <a href={publicConfig.discordUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost">{d.home.discord}</a>
            </div>
            <div className="flex flex-wrap gap-6 text-sm">
              <div>
                <div className="text-mute">{d.home.online}</div>
                <div className="flex items-center gap-2 font-semibold">
                  <span className={`h-2.5 w-2.5 rounded-full ${st.up ? "bg-emerald-400 shadow-[0_0_10px] shadow-emerald-400" : "bg-zinc-600"}`} />
                  {st.up ? `${st.online} / ${st.max} ${d.home.players}` : st.known ? d.home.offline : d.home.unknown}
                </div>
              </div>
              <div>
                <div className="text-mute">{d.home.version}</div>
                <div className="font-semibold">{publicConfig.mcVersion}</div>
              </div>
            </div>
          </div>
          <div className="flex justify-center">
            <Emblem className="h-56 w-56 animate-glow md:h-72 md:w-72" />
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {d.home.features.map(([t, s], i) => (
          <div key={t} className="card p-5 animate-fade-up" style={{ animationDelay: `${i * 80}ms` }}>
            <div className="mb-3 text-gold">✦</div>
            <div className="font-semibold text-white">{t}</div>
            <p className="mt-1 text-sm text-mute">{s}</p>
          </div>
        ))}
      </section>

      {/* VIP + STORE + CREATOR */}
      <section className="grid gap-6 lg:grid-cols-3">
        <Link href="/vip" className="card-gold group overflow-hidden lg:col-span-2">
          <div className="grid h-full md:grid-cols-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/img/vip.svg" alt="" className="h-full w-full object-cover" />
            <div className="space-y-3 p-6">
              <span className="chip border-emerald-500/40 bg-emerald-500/10 text-emerald-300">{d.vip.badge}</span>
              <h2 className="h-title text-3xl gold-text">{d.home.vipTitle}</h2>
              <p className="text-sm text-zinc-300">{d.home.vipText}</p>
              {vip && <div className="text-2xl font-bold text-white">{formatRub(vip.priceKopecks, locale)} <span className="text-sm font-normal text-mute">/ {vip.durationDays} {d.common.days}</span></div>}
              <span className="btn-gold">{d.common.details} →</span>
            </div>
          </div>
        </Link>
        <div className="grid gap-6">
          <Link href="/store" className="card p-6 transition hover:border-gold/50">
            <h3 className="h-title text-xl text-white">{d.home.storeTitle}</h3>
            <p className="mt-2 text-sm text-mute">{d.home.storeText}</p>
          </Link>
          <Link href="/creator" className="card p-6 transition hover:border-gold/50">
            <h3 className="h-title text-xl text-white">{d.home.creatorTitle}</h3>
            <p className="mt-2 text-sm text-mute">{d.home.creatorText}</p>
          </Link>
        </div>
      </section>

      {/* RULES */}
      <section className="card flex flex-col items-start justify-between gap-4 p-6 md:flex-row md:items-center">
        <div>
          <h2 className="h-title text-xl text-white">{d.home.rulesTitle}</h2>
          <p className="text-sm text-mute">{d.home.rulesText}</p>
        </div>
        <Link href="/rules" className="btn-ghost">{d.nav.rules} →</Link>
      </section>
    </div>
  );
}
