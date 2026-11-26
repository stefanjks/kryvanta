"use client";

export type ApiResult<T = unknown> = { ok: true; data: T } | { ok: false; status: number; error: string; message: string };

export async function api<T = unknown>(path: string, method: string = "POST", body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const details = Array.isArray(data.details) ? data.details.map((d: { path?: string[]; message?: string }) => `${(d.path || []).join(".")}: ${d.message}`).join("; ") : "";
      return { ok: false, status: res.status, error: data.error || "error", message: (data.message || "Ошибка") + (details ? ` (${details})` : "") };
    }
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, status: 0, error: "network", message: "Нет соединения с сервером" };
  }
}
