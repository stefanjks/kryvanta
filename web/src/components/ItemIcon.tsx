const map: Record<string, string> = {
  DIAMOND: "/img/px-diamond.svg",
  IRON_INGOT: "/img/px-ingot.svg",
  GOLDEN_APPLE: "/img/px-apple.svg",
  BREAD: "/img/px-bread.svg",
};

export function prettyMaterial(m: string) {
  return m.toLowerCase().split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

export function ItemIcon({ material, size = 40 }: { material: string; size?: number }) {
  const src = map[material];
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={prettyMaterial(material)} width={size} height={size} style={{ imageRendering: "pixelated" }} />;
  }
  return (
    <span className="flex items-center justify-center rounded-md border border-edge bg-coal font-mono text-[10px] text-gold-soft" style={{ width: size, height: size }}>
      {material.slice(0, 2)}
    </span>
  );
}
