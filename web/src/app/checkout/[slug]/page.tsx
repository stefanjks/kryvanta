import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getDict } from "@/lib/i18n";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { activeAdapter } from "@/server/payments";
import { CheckoutForm } from "./CheckoutForm";

export const dynamic = "force-dynamic";

export default async function Checkout({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { locale, d } = await getDict();
  const product = await prisma.product.findUnique({ where: { slug } });
  if (!product || !product.active) notFound();
  const user = await currentUser();
  const account = user ? await prisma.minecraftAccount.findUnique({ where: { userId: user.id } }) : null;
  const ref = (await cookies()).get("kry_ref")?.value ?? "";
  const provider = activeAdapter().id;

  return (
    <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-[1fr_1.1fr]">
      <div className="card-gold overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={product.image} alt="" className="w-full" />
        <div className="space-y-2 p-5">
          <h1 className="h-title text-2xl text-white">{locale === "en" ? product.nameEn : product.nameRu}</h1>
          <p className="text-sm text-mute">{locale === "en" ? product.descriptionEn : product.descriptionRu}</p>
          <ul className="space-y-1 pt-2 text-sm text-zinc-300">
            {(locale === "en" ? product.featuresEn : product.featuresRu).map((f) => <li key={f} className="flex gap-2"><span className="text-gold">✦</span>{f}</li>)}
          </ul>
        </div>
      </div>
      <div className="card space-y-5 p-6">
        <h2 className="h-title text-2xl text-white">{d.store.checkout}</h2>
        {!user ? (
          <div className="space-y-3">
            <p className="text-mute">{d.store.needLogin}</p>
            <div className="flex gap-3">
              <Link href={`/login?next=/checkout/${slug}`} className="btn-gold">{d.nav.login}</Link>
              <Link href={`/register?next=/checkout/${slug}`} className="btn-ghost">{d.nav.register}</Link>
            </div>
          </div>
        ) : !account && product.type !== "VIP_GIFT" ? (
          <div className="space-y-3">
            <p className="text-mute">{d.store.needLink}</p>
            <Link href="/account" className="btn-gold">{d.nav.account}</Link>
          </div>
        ) : (
          <>
            {account && <p className="text-sm text-mute">Minecraft: <span className="font-semibold text-white">{account.name}</span></p>}
            <CheckoutForm
              slug={slug}
              basePrice={product.priceKopecks}
              initialCode={ref}
              gift={product.type === "VIP_GIFT"}
              locale={locale}
              t={{ ...d.store, days: d.common.days }}
            />
            {provider === "test" && <p className="chip border-amber-500/40 bg-amber-500/10 text-amber-300">{d.store.testMode}</p>}
            {provider === "manual" && <p className="text-xs text-mute">{d.store.manualMode}</p>}
          </>
        )}
      </div>
    </div>
  );
}
