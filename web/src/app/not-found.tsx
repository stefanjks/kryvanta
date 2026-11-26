import Link from "next/link";
export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <div className="h-title gold-text text-6xl">404</div>
      <p className="mt-4 text-mute">Страница не найдена · Page not found</p>
      <Link href="/" className="btn-gold mt-6">KRYVANTA</Link>
    </div>
  );
}
