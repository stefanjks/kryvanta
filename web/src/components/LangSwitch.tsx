"use client";
import { useRouter } from "next/navigation";
import { api } from "./api";

export function LangSwitch({ locale }: { locale: "ru" | "en" }) {
  const router = useRouter();
  return (
    <div className="flex overflow-hidden rounded-lg border border-edge text-xs">
      {(["ru", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={locale === l}
          onClick={async () => { await api("/api/lang", "POST", { lang: l }); router.refresh(); }}
          className={`px-2.5 py-1 font-semibold uppercase ${locale === l ? "bg-gold text-ink" : "text-mute hover:text-white"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
