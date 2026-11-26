export function Emblem({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="kg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f5e2a0" />
          <stop offset="0.5" stopColor="#d4af37" />
          <stop offset="1" stopColor="#8a6a14" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="29" fill="none" stroke="url(#kg)" strokeWidth="3" />
      <circle cx="32" cy="32" r="23" fill="#111" stroke="#d4af37" strokeOpacity="0.35" strokeWidth="1" />
      <path d="M32 12 L44 30 L32 52 L20 30 Z" fill="url(#kg)" />
      <path d="M32 12 L32 52 L20 30 Z" fill="#000" fillOpacity="0.18" />
      <path d="M20 30 L44 30" stroke="#fff6d6" strokeOpacity="0.6" strokeWidth="1" />
    </svg>
  );
}

export function Wordmark({ size = "text-lg" }: { size?: string }) {
  return (
    <span className={`h-title ${size} tracking-[0.18em]`}>
      <span className="text-gold">✦ </span>
      <span className="gold-text">KRYVANTA</span>
      <span className="text-gold"> ✦</span>
    </span>
  );
}
