"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/components/api";

type Initial = { key: string; nameRu: string; nameEn: string; tier: string; weight: number; enabled: boolean; items: string } | null;

export function RewardFormClient({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  return (
    <form
      className="grid gap-3 md:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        let items: unknown;
        try { items = JSON.parse(String(fd.get("items"))); } catch { return setMsg({ ok: false, t: "Предметы: некорректный JSON" }); }
        const key = initial?.key ?? String(fd.get("key")).trim();
        const r = await api(`/api/admin/rewards/${encodeURIComponent(key)}`, "PUT", {
          nameRu: fd.get("nameRu"), nameEn: fd.get("nameEn"), tier: fd.get("tier"), weight: Number(fd.get("weight")), enabled: fd.get("enabled") === "on", items,
        });
        setMsg(r.ok ? { ok: true, t: "Сохранено" } : { ok: false, t: r.message });
        if (r.ok) router.refresh();
      }}
    >
      {!initial && <label><span className="label">Ключ (a-z, 0-9)</span><input name="key" className="input" required pattern="[a-z0-9_\-]{2,32}" /></label>}
      <label><span className="label">Название RU</span><input name="nameRu" className="input" defaultValue={initial?.nameRu} required /></label>
      <label><span className="label">Name EN</span><input name="nameEn" className="input" defaultValue={initial?.nameEn} required /></label>
      <label><span className="label">Редкость</span>
        <select name="tier" className="input" defaultValue={initial?.tier ?? "COMMON"}>
          {["COMMON", "RARE", "EPIC", "COSMETIC"].map((t) => <option key={t}>{t}</option>)}
        </select>
      </label>
      <label><span className="label">Вес выпадения</span><input name="weight" type="number" min={0} className="input" defaultValue={initial?.weight ?? 0} /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="enabled" defaultChecked={initial?.enabled ?? true} className="accent-[#d4af37]" /> Включён</label>
      <label className="md:col-span-2"><span className="label">Предметы (JSON: material — имя Bukkit Material)</span>
        <textarea name="items" className="input min-h-32 font-mono text-xs" defaultValue={initial?.items ?? '[{"material":"IRON_INGOT","amount":8}]'} />
      </label>
      <div className="flex items-center gap-3 md:col-span-2">
        <button className="btn-gold">Сохранить</button>
        {msg && <span className={`text-sm ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.t}</span>}
      </div>
    </form>
  );
}
