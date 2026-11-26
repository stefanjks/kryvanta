import Link from "next/link";
import { getDict } from "@/lib/i18n";
import { prisma } from "@/lib/db";
import { formatRub } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Магазин" };

const ORDER = ["vip", "privileges", "cosmetics", "gifts"];

export default async function Store() {
  const { locale, d } = await getDict();
  const products = await prisma.product.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  const cats = [...new Set([...ORDER.filter((c) => products.some((p) => p.category === c)), ...products.map((p) => p.category)])];

  return (
    <div className="space-y-12">
      <div>
        <h1 className="h-title text-4xl gold-text">{d.store.title}</h1>
        <p className="mt-2 text-mute">{d.store.subtitle}</p>
        <nav className="mt-5 flex flex-wrap gap-2">
          {cats.map((c) => (
            <a key={c} href={`#${c}`} className="chip border-edge bg-coal px-3 py-1 text-sm text-zinc-200 hover:border-gold/60">{d.store.categories[c] ?? c}</a>
          ))}
        </nav>
      </div>
      {cats.map((c) => (
        <section key={c} id={c} className="scroll-mt-24 space-y-4">
          <h2 className="h-title text-2xl text-white">{d.store.categories[c] ?? c}</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {products.filter((p) => p.category === c).map((p) => (
              <article key={p.id} className={`${p.type === "VIP" ? "card-gold" : "card"} flex flex-col overflow-hidden`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image} alt="" className="aspect-[400/260] w-full object-cover" />
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <h3 className="h-title text-xl text-white">{locale === "en" ? p.nameEn : p.nameRu}</h3>
                  <p className="text-sm text-mute">{locale === "en" ? p.descriptionEn : p.descriptionRu}</p>
                  <ul className="space-y-1 text-sm text-zinc-300">
                    {(locale === "en" ? p.featuresEn : p.featuresRu).map((f) => <li key={f} className="flex gap-2"><span className="text-gold">✦</span>{f}</li>)}
                  </ul>
                  <div className="mt-auto flex items-end justify-between pt-3">
                    <div>
                      <div className="text-2xl font-bold text-white">{formatRub(p.priceKopecks, locale)}</div>
                      <div className="text-xs text-mute">{d.store.duration}: {p.durationDays ? `${p.durationDays} ${d.common.days}` : d.store.forever}</div>
                    </div>
                    <Link href={`/checkout/${p.slug}`} className="btn-gold">{d.common.buy}</Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
