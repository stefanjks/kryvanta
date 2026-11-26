import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { formatRub } from "@/lib/money";
import { ActionButton } from "@/components/ActionButton";

export const dynamic = "force-dynamic";

/** Страница тестового платёжного провайдера (доступна только при включённом тестовом режиме). */
export default async function TestPay({ params }: { params: Promise<{ paymentId: string }> }) {
  if (!env.allowTestPayments) notFound();
  const { paymentId } = await params;
  const user = await currentUser();
  if (!user) redirect(`/login?next=/pay/test/${paymentId}`);
  if (!/^[0-9a-f-]{36}$/i.test(paymentId)) notFound();
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { purchase: { include: { product: true } } } });
  if (!payment || payment.provider !== "test" || payment.purchase.userId !== user.id) notFound();

  return (
    <div className="mx-auto max-w-md space-y-6 rounded-2xl border-2 border-dashed border-amber-500/50 bg-amber-500/5 p-8">
      <div className="chip border-amber-500/50 bg-amber-500/10 text-amber-300">TEST PAYMENT PROVIDER · деньги не списываются</div>
      <h1 className="text-2xl font-bold text-white">Оплата заказа #{payment.purchase.orderNumber}</h1>
      <p className="text-mute">{payment.purchase.product.nameRu}</p>
      <div className="text-4xl font-bold text-white">{formatRub(payment.amountKopecks)}</div>
      {payment.status === "PENDING" ? (
        <div className="flex flex-wrap gap-3">
          <ActionButton endpoint={`/api/payments/test/${payment.id}`} body={{ outcome: "success" }} label="Оплатить (тест)" className="btn-gold" redirectTo={`/orders/${payment.purchaseId}`} />
          <ActionButton endpoint={`/api/payments/test/${payment.id}`} body={{ outcome: "cancel" }} label="Отказаться" className="btn-ghost" redirectTo={`/orders/${payment.purchaseId}`} />
        </div>
      ) : (
        <p className="text-mute">Платёж уже обработан: {payment.status}</p>
      )}
      <p className="text-xs text-mute">Событие отправляется в обработчик вебхука с HMAC-подписью и проходит те же проверки, что и у реального провайдера.</p>
    </div>
  );
}
