import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDict } from "@/lib/i18n";
import { currentUser } from "@/lib/auth";
import { AuthForm } from "../login/AuthForm";

export const metadata = { title: "Регистрация" };

export default async function Register({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safe = next && next.startsWith("/") && !next.startsWith("//") ? next : "/account";
  if (await currentUser()) redirect(safe);
  const { d } = await getDict();
  const ref = (await cookies()).get("kry_ref")?.value;
  return (
    <div className="mx-auto max-w-md card-gold p-8">
      <h1 className="h-title mb-2 text-3xl text-white">{d.auth.register}</h1>
      {ref && <p className="mb-4 chip border-emerald-500/40 bg-emerald-500/10 text-emerald-300">{d.auth.refApplied}: {ref}</p>}
      <AuthForm mode="register" next={safe} t={d.auth} />
      <p className="mt-6 text-sm text-mute">{d.auth.haveAccount} <Link className="text-gold-soft hover:underline" href="/login">{d.auth.login}</Link></p>
    </div>
  );
}
