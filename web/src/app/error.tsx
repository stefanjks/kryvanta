"use client";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <div className="h-title text-3xl text-white">Что-то пошло не так</div>
      <p className="mt-3 text-mute">Something went wrong. Please try again.</p>
      <button className="btn-gold mt-6" onClick={reset}>Повторить</button>
    </div>
  );
}
