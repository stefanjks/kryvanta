import Link from "next/link";
import { redirect } from "next/navigation";
import { getDict } from "@/lib/i18n";
import { currentUser } from "@/lib/auth";
import { AuthForm } from "./AuthForm";

export const metadata = { title: "Вход" };

const safeNext = (n?: string) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/account");

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await currentUser()) redirect(safeNext(next));
  const { d } = await getDict();
  return (
    <div className="mx-auto max-w-md card-gold p-8">
      <h1 className="h-title mb-6 text-3xl text-white">{d.auth.login}</h1>
      <AuthForm mode="login" next={safeNext(next)} t={d.auth} />
      <p className="mt-6 text-sm text-mute">{d.auth.noAccount} <Link className="text-gold-soft hover:underline" href={`/register${next ? `?next=${encodeURIComponent(next)}` : ""}`}>{d.auth.register}</Link></p>
    </div>
  );
}
