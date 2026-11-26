import type { ReactNode } from "react";

export function Section({ title, subtitle, children, action }: { title: ReactNode; subtitle?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="h-title text-xl text-white">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-mute">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, gold }: { label: string; value: ReactNode; hint?: ReactNode; gold?: boolean }) {
  return (
    <div className={gold ? "card-gold p-4" : "card p-4"}>
      <div className="text-xs uppercase tracking-wider text-mute">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${gold ? "text-gold-soft" : "text-white"}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-mute">{hint}</div>}
    </div>
  );
}

const tone: Record<string, string> = {
  green: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  gold: "border-gold/40 bg-gold/10 text-gold-soft",
  red: "border-red-500/40 bg-red-500/10 text-red-300",
  gray: "border-edge bg-coal text-mute",
  blue: "border-sky-500/40 bg-sky-500/10 text-sky-300",
};

const statusTone: Record<string, keyof typeof tone> = {
  PAID: "green", SUCCEEDED: "green", ACTIVE: "green", APPROVED: "blue", AVAILABLE: "green", QUALIFIED: "green", DELIVERED: "green",
  PENDING: "gold", HOLD: "gold",
  CANCELLED: "gray", EXPIRED: "gray", FAILED: "red", REFUNDED: "red", REJECTED: "red", REVOKED: "red", BLOCKED: "red",
};

export function Badge({ children, color = "gray" }: { children: ReactNode; color?: keyof typeof tone }) {
  return <span className={`chip ${tone[color]}`}>{children}</span>;
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <Badge color={statusTone[status] ?? "gray"}>{label ?? status}</Badge>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-edge p-6 text-center text-sm text-mute">{children}</div>;
}

export function fmtDate(d: Date | string | null | undefined, locale = "ru") {
  if (!d) return "—";
  return new Date(d).toLocaleString(locale === "en" ? "en-GB" : "ru-RU", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Moscow" });
}

export function fmtDuration(seconds: number, locale = "ru") {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return locale === "en" ? `${h} h ${m} min` : `${h} ч ${m} мин`;
}
