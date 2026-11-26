import { getDict } from "@/lib/i18n";

export const metadata = { title: "Правила" };

export default async function Rules() {
  const { d } = await getDict();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="h-title text-4xl gold-text">{d.rules.title}</h1>
      <ol className="space-y-3">
        {d.rules.items.map((r, i) => (
          <li key={i} className="card flex gap-4 p-4">
            <span className="h-title text-xl text-gold">{String(i + 1).padStart(2, "0")}</span>
            <span className="text-zinc-200">{r}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
