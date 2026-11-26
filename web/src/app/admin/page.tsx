import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import * as T from "./tabs";

export const dynamic = "force-dynamic";
export const metadata = { title: "Админ-панель" };

const TABS = [
  ["overview", "Обзор", "Overview"],
  ["purchases", "Покупки", "Purchases"],
  ["creators", "Блогеры", "Creators"],
  ["applications", "Заявки", "Applications"],
  ["codes", "Промокоды", "Promo codes"],
  ["payouts", "Выплаты", "Payouts"],
  ["vip", "VIP", "VIP"],
  ["rewards", "Награды", "Rewards"],
  ["products", "Товары", "Products"],
  ["settings", "Настройки", "Settings"],
  ["users", "Пользователи", "Users"],
  ["audit", "Журнал", "Audit log"],
] as const;

export default async function Admin({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; page?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "ADMIN") redirect("/");
  const sp = await searchParams;
  const tab = TABS.some((t) => t[0] === sp.tab) ? sp.tab! : "overview";
  const { locale } = await getDict();
  const page = Math.max(1, Number(sp.page) || 1);
  const q = (sp.q ?? "").slice(0, 100);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="h-title text-3xl gold-text">{locale === "en" ? "Admin panel" : "Панель администратора"}</h1>
        <span className="chip border-gold/40 text-gold-soft">{user.username}</span>
      </div>
      <nav className="flex gap-1 overflow-x-auto rounded-2xl border border-edge bg-coal p-1">
        {TABS.map(([k, ru, en]) => (
          <Link key={k} href={`/admin?tab=${k}`} className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-sm ${tab === k ? "bg-gold text-ink font-semibold" : "text-zinc-300 hover:text-white"}`}>
            {locale === "en" ? en : ru}
          </Link>
        ))}
      </nav>
      {tab === "overview" && <T.Overview />}
      {tab === "purchases" && <T.Purchases q={q} page={page} />}
      {tab === "creators" && <T.Creators />}
      {tab === "applications" && <T.Applications />}
      {tab === "codes" && <T.Codes />}
      {tab === "payouts" && <T.Payouts />}
      {tab === "vip" && <T.Vip q={q} />}
      {tab === "rewards" && <T.Rewards />}
      {tab === "products" && <T.Products />}
      {tab === "settings" && <T.SettingsTab />}
      {tab === "users" && <T.Users q={q} page={page} />}
      {tab === "audit" && <T.Audit q={q} page={page} />}
    </div>
  );
}
