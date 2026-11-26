"use client";
import { useState } from "react";

export type Point = { label: string; value: number };

/**
 * Одна серия — один цвет (#b8952e, проверен на контраст с тёмной поверхностью).
 * Тонкие столбцы с 4px скруглением, зазор между столбцами, ненавязчивая сетка,
 * подсказка при наведении и табличное представление для доступности.
 */
export function BarChart({ data, format = (v) => String(v), height = 180, title, tableLabel = "Таблица данных" }: {
  data: Point[];
  format?: (v: number) => string;
  height?: number;
  title: string;
  tableLabel?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 600, H = height, padL = 8, padR = 8, padT = 16, padB = 24;
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = Math.max(1, data.length);
  const slot = (W - padL - padR) / n;
  const bw = Math.max(3, Math.min(28, slot - 4));
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / max);
  const ticks = [0, 0.5, 1].map((t) => max * t);
  const every = Math.ceil(n / 8);
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <figure className="relative">
      <figcaption className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-white">{title}</span>
        <span className="text-xs text-mute">{format(total)}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={title} onMouseLeave={() => setHover(null)}>
        {ticks.map((t, i) => (
          <line key={i} x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="#2a2a2e" strokeWidth="1" strokeDasharray={i === 0 ? undefined : "3 4"} />
        ))}
        {data.map((d, i) => {
          const x = padL + i * slot + (slot - bw) / 2;
          const top = y(d.value);
          const h = Math.max(0, H - padB - top);
          const r = Math.min(4, bw / 2, h);
          const path = h <= 0 ? "" : `M${x},${H - padB} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${H - padB} Z`;
          return (
            <g key={i} onMouseEnter={() => setHover(i)}>
              <rect x={padL + i * slot} y={padT} width={slot} height={H - padT - padB} fill="transparent" />
              {path && <path d={path} fill="#b8952e" opacity={hover === null || hover === i ? 1 : 0.45} />}
              {i % every === 0 && (
                <text x={x + bw / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="#a1a1aa">{d.label}</text>
              )}
            </g>
          );
        })}
      </svg>
      {hover !== null && data[hover] && (
        <div
          className="pointer-events-none absolute top-8 z-10 -translate-x-1/2 rounded-lg border border-edge bg-coal px-2.5 py-1.5 text-xs shadow-xl"
          style={{ left: `${((padL + hover * slot + slot / 2) / W) * 100}%` }}
        >
          <div className="text-mute">{data[hover].label}</div>
          <div className="font-semibold text-white">{format(data[hover].value)}</div>
        </div>
      )}
      <details className="mt-1 text-xs text-mute">
        <summary className="cursor-pointer select-none">{tableLabel}</summary>
        <table className="table mt-2">
          <tbody>
            {data.map((d) => (
              <tr key={d.label}><td>{d.label}</td><td className="text-right text-white">{format(d.value)}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
