"use client";
import { useState } from "react";

export function ConnectDialog({ ip, version, title, steps, play }: { ip: string; version: string; title: string; steps: string[]; play: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="btn-gold"
        onClick={async () => {
          try { await navigator.clipboard.writeText(ip); } catch { /* ignore */ }
          setOpen(true);
        }}
      >
        ▶ {play}
      </button>
      {open && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setOpen(false)}>
          <div className="card-gold w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="h-title text-xl text-white">{title}</h3>
            <ol className="mt-4 space-y-3 text-sm text-zinc-200">
              {steps.map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold text-xs font-bold text-ink">{i + 1}</span>
                  <span>{s}{i === 0 ? ` ${version}` : ""}{i === 2 ? <code className="ml-1 font-mono text-gold-soft">{ip}</code> : null}</span>
                </li>
              ))}
            </ol>
            <button type="button" className="btn-ghost mt-6 w-full" onClick={() => setOpen(false)}>OK</button>
          </div>
        </div>
      )}
    </>
  );
}
