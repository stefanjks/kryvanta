import Link from "next/link";
import { getDict } from "@/lib/i18n";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatRub } from "@/lib/money";
import { ApiForm } from "@/components/ApiForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Creator Program" };

export default async function CreatorProgram() {
  const { locale, d } = await getDict();
  const user = await currentUser();
  const [creator, pending, s] = await Promise.all([
    user ? prisma.creator.findUnique({ where: { userId: user.id } }) : null,
    user ? prisma.creatorApplication.findFirst({ where: { userId: user.id, status: "PENDING" } }) : null,
    getSettings(),
  ]);
  const tiers = [
    ["Bronze", 0], ["Silver", s.tierThresholds.SILVER], ["Gold", s.tierThresholds.GOLD], ["Diamond", s.tierThresholds.DIAMOND],
  ] as const;

  return (
    <div className="space-y-14">
      <section className="space-y-4 text-center">
        <h1 className="h-title text-4xl md:text-6xl gold-text">{d.creator.title}</h1>
        <p className="text-lg text-zinc-300">{d.creator.subtitle}</p>
        <div className="flex justify-center gap-3 text-sm text-mute">
          <span className="chip border-red-500/40 text-red-300">YouTube</span>
          <span className="chip border-zinc-400/40 text-zinc-200">TikTok</span>
          <span className="chip border-violet-500/40 text-violet-300">Twitch</span>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {d.creator.perks.map(([t, x]) => (
          <div key={t} className="card-gold p-5">
            <div className="h-title text-xl text-gold-soft">{t}</div>
            <p className="mt-2 text-sm text-zinc-300">{x}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="card space-y-4 p-6">
          <p className="text-zinc-200">{d.creator.example}</p>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between"><span className="text-mute">{locale === "en" ? "Active player bonus" : "Бонус за активного игрока"}</span><b>{formatRub(s.activePlayerBonusKopecks, locale)}</b></li>
            {s.milestones.map((m) => (
              <li key={m.count} className="flex justify-between"><span className="text-mute">{m.count} {locale === "en" ? "active players" : "активных игроков"}</span><b>{formatRub(m.bonusKopecks, locale)}</b></li>
            ))}
          </ul>
          <div className="grid grid-cols-4 gap-2 pt-2 text-center text-xs">
            {tiers.map(([n, v]) => (
              <div key={n} className="rounded-lg border border-edge bg-coal p-2"><div className="font-semibold text-white">{n}</div><div className="text-mute">{v ? `≥ ${formatRub(v, locale)}` : "—"}</div></div>
            ))}
          </div>
        </div>

        <div className="card-gold p-6">
          <h2 className="h-title mb-4 text-2xl text-white">{d.creator.apply}</h2>
          {!user ? (
            <div className="space-y-3"><p className="text-mute">{d.creator.loginFirst}</p><Link href="/login?next=/creator" className="btn-gold">{d.nav.login}</Link></div>
          ) : creator ? (
            <div className="space-y-3"><p className="text-mute">{d.creator.already}</p><Link href="/creator/dashboard" className="btn-gold">{d.creator.openDashboard}</Link></div>
          ) : pending ? (
            <p className="text-gold-soft">{d.creator.pending}</p>
          ) : (
            <ApiForm
              endpoint="/api/creator/apply"
              submitLabel={d.creator.apply}
              successMessage={d.creator.sent}
              columns={2}
              fields={[
                { name: "displayName", label: d.creator.displayName, required: true },
                { name: "platform", label: d.creator.platform, type: "select", options: [{ value: "youtube", label: "YouTube" }, { value: "tiktok", label: "TikTok" }, { value: "twitch", label: "Twitch" }] },
                { name: "channelUrl", label: d.creator.channelUrl, required: true, placeholder: "https://" },
                { name: "audience", label: d.creator.audience, type: "number", required: true },
                { name: "message", label: d.creator.message, type: "textarea" },
              ]}
            />
          )}
        </div>
      </section>
    </div>
  );
}
