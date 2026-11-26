"use client";
import { useRouter } from "next/navigation";
import { api } from "./api";

export function LogoutButton({ label }: { label: string }) {
  const router = useRouter();
  return (
    <button type="button" className="text-sm text-mute hover:text-white" onClick={async () => { await api("/api/auth/logout", "POST", {}); router.push("/"); router.refresh(); }}>
      {label}
    </button>
  );
}
