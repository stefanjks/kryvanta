"use client";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { api } from "./api";

export type Field = {
  name: string;
  label: string;
  type?: "text" | "number" | "email" | "password" | "textarea" | "select" | "checkbox" | "datetime-local" | "money" | "percent" | "json" | "lines";
  options?: { value: string; label: string }[];
  defaultValue?: string | number | boolean | null;
  placeholder?: string;
  required?: boolean;
  help?: string;
  wide?: boolean;
};

type Props = {
  endpoint: string;
  method?: string;
  fields: Field[];
  submitLabel: string;
  successMessage?: string;
  extra?: Record<string, unknown>;
  redirectTo?: string | ((data: unknown) => string | null);
  columns?: 1 | 2 | 3;
  resetOnSuccess?: boolean;
  footer?: ReactNode;
};

/** Универсальная форма, отправляющая JSON в REST API. money — рубли → копейки, percent — % → bps. */
export function ApiForm({ endpoint, method = "POST", fields, submitLabel, successMessage, extra, redirectTo, columns = 1, resetOnSuccess, footer }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const body: Record<string, unknown> = { ...(extra ?? {}) };
    try {
      for (const f of fields) {
        const raw = fd.get(f.name);
        if (f.type === "checkbox") { body[f.name] = raw === "on"; continue; }
        const s = typeof raw === "string" ? raw.trim() : "";
        if (s === "") { body[f.name] = null; continue; }
        switch (f.type) {
          case "number": body[f.name] = Number(s); break;
          case "money": body[f.name] = Math.round(Number(s.replace(",", ".")) * 100); break;
          case "percent": body[f.name] = Math.round(Number(s.replace(",", ".")) * 100); break;
          case "json": body[f.name] = JSON.parse(s); break;
          case "lines": body[f.name] = s.split("\n").map((x) => x.trim()).filter(Boolean); break;
          case "datetime-local": body[f.name] = new Date(s).toISOString(); break;
          default: body[f.name] = s;
        }
      }
    } catch {
      setMsg({ ok: false, text: "Некорректный формат данных (JSON)" });
      return;
    }
    setBusy(true);
    setMsg(null);
    const r = await api(endpoint, method, body);
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.message });
    setMsg({ ok: true, text: successMessage ?? "Сохранено" });
    if (resetOnSuccess) form.reset();
    const target = typeof redirectTo === "function" ? redirectTo(r.data) : redirectTo;
    if (target) router.push(target);
    else router.refresh();
  }

  const grid = columns === 3 ? "md:grid-cols-3" : columns === 2 ? "md:grid-cols-2" : "";
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className={`grid gap-4 ${grid}`}>
        {fields.map((f) => (
          <div key={f.name} className={f.wide || f.type === "textarea" || f.type === "json" || f.type === "lines" ? "md:col-span-full" : ""}>
            {f.type === "checkbox" ? (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name={f.name} defaultChecked={Boolean(f.defaultValue)} className="h-4 w-4 accent-[#d4af37]" />
                {f.label}
              </label>
            ) : (
              <label className="block">
                <span className="label">{f.label}</span>
                {f.type === "textarea" || f.type === "json" || f.type === "lines" ? (
                  <textarea name={f.name} className="input min-h-28 font-mono text-xs" defaultValue={(f.defaultValue as string) ?? ""} placeholder={f.placeholder} required={f.required} />
                ) : f.type === "select" ? (
                  <select name={f.name} className="input" defaultValue={(f.defaultValue as string) ?? ""} required={f.required}>
                    {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <input
                    name={f.name}
                    type={f.type === "money" || f.type === "percent" ? "text" : f.type ?? "text"}
                    inputMode={f.type === "money" || f.type === "percent" || f.type === "number" ? "decimal" : undefined}
                    className="input"
                    defaultValue={f.defaultValue === null || f.defaultValue === undefined ? "" : String(f.defaultValue)}
                    placeholder={f.placeholder}
                    required={f.required}
                  />
                )}
              </label>
            )}
            {f.help && <p className="mt-1 text-xs text-mute">{f.help}</p>}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className="btn-gold">{busy ? "…" : submitLabel}</button>
        {msg && <span className={`text-sm ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</span>}
        {footer}
      </div>
    </form>
  );
}
