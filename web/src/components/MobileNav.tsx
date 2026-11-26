"use client";
import Link from "next/link";
import { useState } from "react";

export function MobileNav({ links }: { links: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="lg:hidden">
      <button type="button" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)} className="rounded-lg border border-edge p-2 text-white">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>
      {open && (
        <nav className="absolute left-0 right-0 top-full border-b border-edge bg-ink/95 px-4 py-3 backdrop-blur">
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm text-zinc-200 hover:bg-panel hover:text-gold-soft">
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
