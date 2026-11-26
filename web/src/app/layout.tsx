import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getDict } from "@/lib/i18n";
import { currentUser } from "@/lib/auth";
import { publicConfig } from "@/lib/env";
import { Emblem, Wordmark } from "@/components/Logo";
import { LangSwitch } from "@/components/LangSwitch";
import { LogoutButton } from "@/components/LogoutButton";
import { MobileNav } from "@/components/MobileNav";

export const metadata: Metadata = {
  title: { default: "✦ KRYVANTA ✦ — Minecraft 1.21.11", template: "%s · KRYVANTA" },
  description: "Честное ванильное выживание без Pay-to-Win. Minecraft 1.21.11.",
  icons: { icon: "/img/emblem.svg" },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, d } = await getDict();
  const user = await currentUser();
  const links = [
    { href: "/", label: d.nav.home },
    { href: "/store", label: d.nav.store },
    { href: "/vip", label: d.nav.vip },
    { href: "/creator", label: d.nav.creators },
    { href: "/rules", label: d.nav.rules },
  ];
  const userLinks = user
    ? [
        { href: "/account", label: d.nav.account },
        ...(user.role === "CREATOR" || user.role === "ADMIN" ? [{ href: "/creator/dashboard", label: d.nav.dashboard }] : []),
        ...(user.role === "ADMIN" ? [{ href: "/admin", label: d.nav.admin }] : []),
      ]
    : [{ href: "/login", label: d.nav.login }, { href: "/register", label: d.nav.register }];

  return (
    <html lang={locale}>
      <body className="font-sans antialiased">
        <header className="sticky top-0 z-40 border-b border-edge/70 bg-ink/80 backdrop-blur-md">
          <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
            <Link href="/" className="flex items-center gap-2.5">
              <Emblem className="h-9 w-9 animate-glow" />
              <Wordmark />
            </Link>
            <nav className="hidden items-center gap-1 lg:flex">
              {links.map((l) => (
                <Link key={l.href} href={l.href} className="rounded-lg px-3 py-2 text-sm text-zinc-300 transition hover:bg-panel hover:text-gold-soft">{l.label}</Link>
              ))}
            </nav>
            <div className="flex items-center gap-3">
              <LangSwitch locale={locale} />
              <div className="hidden items-center gap-3 lg:flex">
                {userLinks.map((l) => (
                  <Link key={l.href} href={l.href} className={l.href === "/register" || l.href === "/account" ? "btn-gold !px-4 !py-2" : "text-sm text-zinc-300 hover:text-gold-soft"}>{l.label}</Link>
                ))}
                {user && <LogoutButton label={d.nav.logout} />}
              </div>
              <MobileNav links={[...links, ...userLinks]} />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-10">{children}</main>
        <footer className="mt-16 border-t border-edge/70">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-mute md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <Emblem className="h-7 w-7" />
              <div>
                <Wordmark size="text-sm" />
                <div className="text-xs">IP: {publicConfig.serverIp} · Minecraft {publicConfig.mcVersion}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              <Link href="/rules" className="hover:text-white">{d.nav.rules}</Link>
              <a href={publicConfig.discordUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white">Discord</a>
              <Link href="/creator" className="hover:text-white">{d.nav.creators}</Link>
            </div>
            <p className="max-w-md text-xs">{d.footer.rights}</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
