"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/components/api";

export function LinkCode({ t }: { t: { link: string; linkHelp: string; linkExpires: string } }) {
  const router = useRouter();
  const [code, setCode] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      {!code ? (
        <button type="button" className="btn-gold" onClick={async () => {
          const r = await api<{ code: string }>("/api/account/link-code", "POST", {});
          if (!r.ok) return setErr(r.message);
          setCode(r.data.code);
          // проверяем привязку каждые 5 секунд
          const iv = setInterval(async () => {
            const me = await api<{ minecraft: unknown }>("/api/me", "GET");
            if (me.ok && me.data.minecraft) { clearInterval(iv); router.refresh(); }
          }, 5000);
          setTimeout(() => clearInterval(iv), 10 * 60_000);
        }}>{t.link}</button>
      ) : (
        <div className="rounded-xl border border-gold/40 bg-black/40 p-4">
          <p className="text-sm text-mute">{t.linkHelp}</p>
          <code className="mt-2 block select-all font-mono text-2xl tracking-widest text-gold-soft">/link {code}</code>
          <p className="mt-2 text-xs text-mute">{t.linkExpires}</p>
        </div>
      )}
      {err && <p className="text-sm text-red-400">{err}</p>}
    </div>
  );
}
