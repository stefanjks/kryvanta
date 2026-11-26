"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "./api";

type Props = {
  endpoint: string;
  method?: string;
  body?: unknown;
  label: string;
  className?: string;
  confirm?: string;
  /** Запросить у администратора текстовое значение (например, комментарий) и передать в body[promptField] */
  prompt?: { field: string; message: string; required?: boolean };
  redirectTo?: string;
  onDone?: (data: unknown) => void;
};

export function ActionButton({ endpoint, method = "POST", body, label, className = "btn-ghost", confirm, prompt, redirectTo, onDone }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        disabled={busy}
        className={className}
        onClick={async () => {
          if (confirm && !window.confirm(confirm)) return;
          let payload = body ?? {};
          if (prompt) {
            const v = window.prompt(prompt.message);
            if (v === null) return;
            if (prompt.required && !v.trim()) return;
            payload = { ...(payload as object), [prompt.field]: v };
          }
          setBusy(true);
          setErr(null);
          const r = await api(endpoint, method, payload);
          setBusy(false);
          if (!r.ok) return setErr(r.message);
          onDone?.(r.data);
          if (redirectTo) router.push(redirectTo);
          else router.refresh();
        }}
      >
        {busy ? "…" : label}
      </button>
      {err && <span className="text-xs text-red-400">{err}</span>}
    </span>
  );
}
