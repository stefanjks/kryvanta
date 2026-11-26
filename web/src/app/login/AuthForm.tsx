"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/components/api";

type T = { email: string; username: string; loginField: string; password: string; passwordHint: string; submitLogin: string; submitRegister: string };

export function AuthForm({ mode, next, t }: { mode: "login" | "register"; next: string; t: T }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setBusy(true);
        setErr(null);
        const body = mode === "login"
          ? { login: fd.get("login"), password: fd.get("password") }
          : { email: fd.get("email"), username: fd.get("username"), password: fd.get("password") };
        const r = await api(`/api/auth/${mode}`, "POST", body);
        setBusy(false);
        if (!r.ok) return setErr(r.message);
        router.push(next);
        router.refresh();
      }}
    >
      {mode === "login" ? (
        <label className="block"><span className="label">{t.loginField}</span><input name="login" className="input" required autoComplete="username" /></label>
      ) : (
        <>
          <label className="block"><span className="label">{t.email}</span><input name="email" type="email" className="input" required autoComplete="email" /></label>
          <label className="block"><span className="label">{t.username}</span><input name="username" className="input" required minLength={3} maxLength={24} pattern="[A-Za-z0-9_.\-]+" autoComplete="username" /></label>
        </>
      )}
      <label className="block">
        <span className="label">{t.password}</span>
        <input name="password" type="password" className="input" required minLength={mode === "register" ? 10 : 1} autoComplete={mode === "login" ? "current-password" : "new-password"} />
        {mode === "register" && <span className="mt-1 block text-xs text-mute">{t.passwordHint}</span>}
      </label>
      {err && <p className="text-sm text-red-400">{err}</p>}
      <button type="submit" disabled={busy} className="btn-gold w-full">{busy ? "…" : mode === "login" ? t.submitLogin : t.submitRegister}</button>
    </form>
  );
}
