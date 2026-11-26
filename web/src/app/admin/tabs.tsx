import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { formatRub } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { creatorBalance, releaseHolds } from "@/server/payouts";
import { adminOverview } from "@/server/adminStats";
import { serverStatus } from "@/server/status";
import { activeAdapter } from "@/server/payments";
import { Section, Stat, StatusBadge, Empty, fmtDate, fmtDuration, Badge } from "@/components/ui";
import { ActionButton } from "@/components/ActionButton";
import { ApiForm } from "@/components/ApiForm";
import { RubChart } from "@/components/Charts";
import { RewardFormClient } from "./RewardFormClient";

const PAGE = 30;
const rub = (k: number) => formatRub(k);

function Search({ tab, q, placeholder }: { tab: string; q: string; placeholder: string }) {
  return (
    <form className="flex gap-2" action="/admin">
      <input type="hidden" name="tab" value={tab} />
      <input name="q" defaultValue={q} placeholder={placeholder} className="input max-w-sm" />
      <button className="btn-ghost">Найти</button>
    </form>
  );
}

function Pager({ tab, q, page, hasMore }: { tab: string; q: string; page: number; hasMore: boolean }) {
  const href = (p: number) => `/admin?tab=${tab}&page=${p}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
  return (
    <div className="flex gap-2">
      {page > 1 && <Link className="btn-ghost" href={href(page - 1)}>← Назад</Link>}
      {hasMore && <Link className="btn-ghost" href={href(page + 1)}>Далее →</Link>}
    </div>
  );
}

/* ---------------------------------- ОБЗОР ---------------------------------- */
export async function Overview() {
  const [s, st] = await Promise.all([adminOverview(), serverStatus()]);
  const provider = activeAdapter().id;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat gold label="Общая выручка" value={rub(s.revenue)} hint={`${s.sales} продаж`} />
        <Stat label="Сегодня" value={rub(s.todayRevenue)} hint={`${s.todaySales} покупок`} />
        <Stat label="За месяц" value={rub(s.monthRevenue)} hint={`${s.monthSales} покупок`} />
        <Stat label="Активные VIP" value={s.activeVips} />
        <Stat label="Блогеры" value={s.creators} hint={s.pendingApps ? `${s.pendingApps} заявок ждут` : undefined} />
        <Stat label="Приглашённые игроки" value={s.referrals} />
        <Stat label="Начислено комиссий" value={rub(s.commissions)} />
        <Stat label="Необработанные выплаты" value={rub(s.pendingPayouts)} hint={`${s.pendingPayoutsCount} заявок`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="card p-5"><RubChart title="Выручка за 30 дней" data={s.revenue30} /></div>
        <div className="card space-y-3 p-5 text-sm">
          <div className="font-semibold text-white">Состояние системы</div>
          <div className="flex justify-between"><span className="text-mute">Игровой сервер</span>{st.up ? <Badge color="green">онлайн · {st.online}/{st.max}</Badge> : <Badge color="red">нет связи</Badge>}</div>
          <div className="flex justify-between"><span className="text-mute">Последняя синхронизация</span><span>{st.known ? fmtDate(st.lastSeen) : "никогда"}</span></div>
          <div className="flex justify-between"><span className="text-mute">Платёжный провайдер</span><Badge color={provider === "yookassa" ? "green" : "gold"}>{provider}</Badge></div>
          <div className="flex justify-between"><span className="text-mute">Ожидают оплаты</span><span>{s.pendingOrders}</span></div>
          {provider !== "yookassa" && <p className="text-xs text-amber-300">Реальный провайдер не подключён: заказы подтверждаются {provider === "manual" ? "вручную во вкладке «Покупки»" : "тестовым провайдером"}.</p>}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- ПОКУПКИ --------------------------------- */
export async function Purchases({ q, page }: { q: string; page: number }) {
  const where: Prisma.PurchaseWhereInput = q
    ? { OR: [{ recipientName: { contains: q, mode: "insensitive" } }, { user: { username: { contains: q, mode: "insensitive" } } }, ...(/^\d+$/.test(q) ? [{ orderNumber: Number(q) }] : [])] }
    : {};
  const rows = await prisma.purchase.findMany({
    where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE + 1,
    include: { user: { select: { username: true } }, product: { select: { nameRu: true } }, creator: { select: { displayName: true } }, creatorCode: { select: { code: true } }, payments: { orderBy: { createdAt: "desc" }, take: 1 }, commissions: true },
  });
  return (
    <Section title="Покупки" subtitle="Ручное подтверждение оплаты, возвраты и отмена заказов. Все действия попадают в журнал." action={<Search tab="purchases" q={q} placeholder="Ник, пользователь или № заказа" />}>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>#</th><th>Покупатель → получатель</th><th>Товар</th><th>Сумма</th><th>Партнёр</th><th>Платёж</th><th>Статус</th><th>Дата</th><th></th></tr></thead>
          <tbody>
            {rows.slice(0, PAGE).map((p) => (
              <tr key={p.id}>
                <td><Link href={`/orders/${p.id}`} className="text-gold-soft">#{p.orderNumber}</Link></td>
                <td>{p.user.username} → <b>{p.recipientName}</b></td>
                <td>{p.product.nameRu}</td>
                <td>{rub(p.amountKopecks)}{p.discountKopecks > 0 && <div className="text-xs text-mute">из {rub(p.basePriceKopecks)}</div>}</td>
                <td>{p.creator ? <>{p.creator.displayName} <span className="font-mono text-xs text-mute">{p.creatorCode?.code}</span>{p.commissions.map((c) => <div key={c.id} className="text-xs text-mute">комиссия {rub(c.amountKopecks)} · {c.status}</div>)}</> : "—"}</td>
                <td className="text-xs">{p.payments[0]?.provider}<div className="text-mute">{p.payments[0]?.status}</div></td>
                <td><StatusBadge status={p.status} /></td>
                <td className="text-xs text-mute">{fmtDate(p.createdAt)}{p.paidAt && <div>опл. {fmtDate(p.paidAt)}</div>}</td>
                <td className="space-y-1">
                  {p.status === "PENDING" && (
                    <>
                      <ActionButton endpoint={`/api/admin/purchases/${p.id}`} body={{ action: "confirm" }} label="Подтвердить оплату" className="btn-gold !px-3 !py-1.5 text-xs" confirm={`Подтвердить, что заказ #${p.orderNumber} на ${rub(p.amountKopecks)} оплачен? Будут начислены VIP и комиссия.`} />
                      <ActionButton endpoint={`/api/admin/purchases/${p.id}`} body={{ action: "cancel" }} label="Отменить" className="btn-ghost !px-3 !py-1.5 text-xs" />
                    </>
                  )}
                  {p.status === "PAID" && (
                    <ActionButton endpoint={`/api/admin/purchases/${p.id}`} body={{ action: "refund" }} label="Возврат" className="btn-danger !px-3 !py-1.5 text-xs" prompt={{ field: "reason", message: "Причина возврата (комиссия будет отменена, срок VIP уменьшен):", required: true }} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className="p-4"><Empty>Покупок нет</Empty></div>}
      </div>
      <Pager tab="purchases" q={q} page={page} hasMore={rows.length > PAGE} />
    </Section>
  );
}

/* --------------------------------- БЛОГЕРЫ --------------------------------- */
export async function Creators() {
  await releaseHolds();
  const s = await getSettings();
  const creators = await prisma.creator.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { username: true, email: true } }, codes: true, _count: { select: { referrals: true, purchases: { where: { status: "PAID" } } } } },
  });
  const balances = await Promise.all(creators.map((c) => creatorBalance(c.id)));
  const qualified = await prisma.referral.groupBy({ by: ["creatorId"], where: { status: "QUALIFIED" }, _count: true });
  const qMap = new Map(qualified.map((x) => [x.creatorId, x._count]));
  const recent = await prisma.commission.findMany({ orderBy: { createdAt: "desc" }, take: 20, include: { creator: { select: { displayName: true } }, purchase: { select: { orderNumber: true } } } });

  return (
    <div className="space-y-8">
      <Section title="Добавить блогера" subtitle="Пользователь должен быть зарегистрирован на сайте.">
        <div className="card p-5">
          <ApiForm endpoint="/api/admin/creators" submitLabel="Добавить" columns={3} resetOnSuccess fields={[
            { name: "user", label: "Email / имя / ник Minecraft", required: true },
            { name: "displayName", label: "Имя блогера", required: true },
            { name: "code", label: "Промокод (необязательно)", placeholder: "Сгенерируется из имени" },
            { name: "platform", label: "Платформа", type: "select", options: [{ value: "youtube", label: "YouTube" }, { value: "tiktok", label: "TikTok" }, { value: "twitch", label: "Twitch" }] },
            { name: "channelUrl", label: "Ссылка на канал" },
            { name: "commissionBps", label: `Индивидуальная комиссия, % (пусто — ${s.commissionBps / 100}%)`, type: "percent" },
          ]} />
        </div>
      </Section>

      <Section title={`Блогеры (${creators.length})`}>
        {creators.length === 0 ? <Empty>Блогеров пока нет</Empty> : (
          <div className="space-y-3">
            {creators.map((c, i) => (
              <details key={c.id} className="card p-4">
                <summary className="flex cursor-pointer flex-wrap items-center gap-3">
                  <span className="font-semibold text-white">{c.displayName}</span>
                  <span className="text-xs text-mute">{c.user.username}</span>
                  <StatusBadge status={c.status} />
                  <Badge color="gold">{c.tier}</Badge>
                  <span className="font-mono text-xs text-gold-soft">{c.codes.map((x) => x.code).join(", ")}</span>
                  <span className="ml-auto text-sm">доступно <b>{rub(balances[i].available)}</b> · заморожено {rub(balances[i].hold)} · выплачено {rub(balances[i].paid)}</span>
                </summary>
                <div className="mt-4 grid gap-6 border-t border-edge pt-4 lg:grid-cols-2">
                  <div className="space-y-2 text-sm">
                    <div>Приглашено: <b>{c._count.referrals}</b> · активных: <b>{qMap.get(c.id) ?? 0}</b> · оплаченных покупок: <b>{c._count.purchases}</b></div>
                    <div>Комиссия: <b>{c.commissionBps !== null ? `${c.commissionBps / 100}% (индивидуальная)` : `${(s.commissionBps + (s.tierBonusBps[c.tier] ?? 0)) / 100}% (стандартная${s.tierBonusBps[c.tier] ? " + уровень" : ""})`}</b></div>
                    <div>Бонус за активного игрока: <b>{rub(c.activeBonusKopecks ?? s.activePlayerBonusKopecks)}</b></div>
                    <div className="flex flex-wrap gap-2 pt-2">
                      {c.status === "APPROVED"
                        ? <ActionButton endpoint={`/api/admin/creators/${c.id}`} method="PATCH" body={{ status: "BLOCKED" }} label="Заблокировать" className="btn-danger !py-1.5 text-xs" confirm="Заблокировать партнёра? Его промокоды перестанут работать." />
                        : <ActionButton endpoint={`/api/admin/creators/${c.id}`} method="PATCH" body={{ status: "APPROVED" }} label="Разблокировать" className="btn-ghost !py-1.5 text-xs" />}
                      <Link href={`/admin?tab=audit&q=${c.id}`} className="btn-ghost !py-1.5 text-xs">История действий</Link>
                    </div>
                  </div>
                  <div className="space-y-5">
                    <ApiForm endpoint={`/api/admin/creators/${c.id}`} method="PATCH" submitLabel="Сохранить условия" columns={2} fields={[
                      { name: "displayName", label: "Имя", defaultValue: c.displayName },
                      { name: "avatarUrl", label: "Аватар (https://…)", defaultValue: c.avatarUrl },
                      { name: "commissionBps", label: "Комиссия, % (пусто = стандартная)", type: "percent", defaultValue: c.commissionBps !== null ? c.commissionBps / 100 : "" },
                      { name: "activeBonusKopecks", label: "Бонус за активного игрока, ₽ (пусто = стандарт)", type: "money", defaultValue: c.activeBonusKopecks !== null ? c.activeBonusKopecks / 100 : "" },
                    ]} />
                    <ApiForm endpoint={`/api/admin/creators/${c.id}/adjust`} submitLabel="Корректировка баланса" columns={2} resetOnSuccess fields={[
                      { name: "amountKopecks", label: "Сумма, ₽ (может быть отрицательной)", type: "money", required: true },
                      { name: "note", label: "Причина (обязательно)", required: true },
                    ]} />
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </Section>

      <Section title="Последние начисления" subtitle="Отмена начисления не удаляет запись — меняется только статус, причина сохраняется в журнале.">
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Дата</th><th>Блогер</th><th>Тип</th><th>Сумма</th><th>Статус</th><th></th></tr></thead>
            <tbody>
              {recent.map((c) => (
                <tr key={c.id}>
                  <td className="text-xs text-mute">{fmtDate(c.createdAt)}</td>
                  <td>{c.creator.displayName}</td>
                  <td>{c.type}{c.purchase ? ` #${c.purchase.orderNumber}` : ""}{c.note ? <div className="text-xs text-mute">{c.note}</div> : null}</td>
                  <td>{rub(c.amountKopecks)}</td>
                  <td><StatusBadge status={c.status} />{c.cancelReason && <div className="text-xs text-mute">{c.cancelReason}</div>}</td>
                  <td>{c.status !== "CANCELLED" && <ActionButton endpoint={`/api/admin/commissions/${c.id}`} label="Отменить" className="btn-ghost !px-2 !py-1 text-xs" prompt={{ field: "reason", message: "Причина отмены начисления:", required: true }} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

/* ---------------------------------- ЗАЯВКИ --------------------------------- */
export async function Applications() {
  const apps = await prisma.creatorApplication.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 100, include: { user: { select: { username: true, email: true, createdAt: true } } } });
  return (
    <Section title="Заявки в Creator Program">
      {apps.length === 0 ? <Empty>Заявок нет</Empty> : (
        <div className="grid gap-4 md:grid-cols-2">
          {apps.map((a) => (
            <div key={a.id} className="card space-y-3 p-5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">{a.displayName}</span>
                <StatusBadge status={a.status} />
              </div>
              <div className="text-sm text-mute">{a.user.username} · {a.user.email} · аккаунт с {fmtDate(a.user.createdAt)}</div>
              <div className="text-sm"><Badge>{a.platform}</Badge> <a href={a.channelUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-gold-soft hover:underline">{a.channelUrl}</a> · {a.audience.toLocaleString("ru-RU")} подписчиков</div>
              {a.message && <p className="whitespace-pre-wrap rounded-lg bg-coal p-3 text-sm text-zinc-300">{a.message}</p>}
              {a.reviewNote && <p className="text-xs text-mute">Комментарий: {a.reviewNote}</p>}
              {a.status === "PENDING" && (
                <div className="flex flex-wrap gap-2">
                  <ActionButton endpoint={`/api/admin/applications/${a.id}`} body={{ action: "approve" }} label="Одобрить" className="btn-gold !py-1.5 text-xs" prompt={{ field: "code", message: "Промокод для блогера (пусто — сгенерировать из имени):" }} />
                  <ActionButton endpoint={`/api/admin/applications/${a.id}`} body={{ action: "reject" }} label="Отклонить" className="btn-danger !py-1.5 text-xs" prompt={{ field: "note", message: "Причина отказа (увидит заявитель):" }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

/* --------------------------------- ПРОМОКОДЫ -------------------------------- */
export async function Codes() {
  const [codes, creators] = await Promise.all([
    prisma.creatorCode.findMany({ orderBy: { createdAt: "desc" }, include: { creator: { select: { displayName: true, status: true } }, _count: { select: { purchases: true } } } }),
    prisma.creator.findMany({ orderBy: { displayName: "asc" }, select: { id: true, displayName: true } }),
  ]);
  const paidAgg = await prisma.purchase.groupBy({ by: ["creatorCodeId"], where: { status: "PAID", creatorCodeId: { not: null } }, _sum: { amountKopecks: true, discountKopecks: true }, _count: true });
  const m = new Map(paidAgg.map((x) => [x.creatorCodeId, x]));
  return (
    <div className="space-y-8">
      <Section title="Создать промокод">
        <div className="card p-5">
          {creators.length === 0 ? <Empty>Сначала добавьте блогера</Empty> : (
            <ApiForm endpoint="/api/admin/codes" submitLabel="Создать" columns={3} resetOnSuccess fields={[
              { name: "creatorId", label: "Блогер", type: "select", options: creators.map((c) => ({ value: c.id, label: c.displayName })) },
              { name: "code", label: "Код", required: true, placeholder: "SUMMER25" },
              { name: "discountBps", label: "Скидка, %", type: "percent", defaultValue: 10 },
              { name: "maxUses", label: "Лимит использований (пусто — без лимита)", type: "number" },
              { name: "expiresAt", label: "Действует до", type: "datetime-local" },
              { name: "onePerUser", label: "Одно использование на аккаунт", type: "checkbox", defaultValue: true },
            ]} />
          )}
        </div>
      </Section>
      <Section title="Промокоды и статистика применения">
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Код</th><th>Блогер</th><th>Скидка</th><th>Использований</th><th>Оплачено</th><th>Срок</th><th>Статус</th><th></th></tr></thead>
            <tbody>
              {codes.map((c) => {
                const st = m.get(c.id);
                return (
                  <tr key={c.id}>
                    <td className="font-mono text-gold-soft">{c.code}</td>
                    <td>{c.creator.displayName}</td>
                    <td>{c.discountBps / 100}%</td>
                    <td>{c.usesCount}{c.maxUses ? ` / ${c.maxUses}` : ""}<div className="text-xs text-mute">заказов создано: {c._count.purchases}</div></td>
                    <td>{st ? <>{rub(st._sum.amountKopecks ?? 0)}<div className="text-xs text-mute">скидки {rub(st._sum.discountKopecks ?? 0)}</div></> : "—"}</td>
                    <td className="text-xs">{c.expiresAt ? fmtDate(c.expiresAt) : "бессрочно"}</td>
                    <td>{c.active ? <Badge color="green">активен</Badge> : <Badge color="red">отключён</Badge>}</td>
                    <td className="space-y-1">
                      <ActionButton endpoint={`/api/admin/codes/${c.id}`} method="PATCH" body={{ active: !c.active }} label={c.active ? "Отключить" : "Включить"} className="btn-ghost !px-2 !py-1 text-xs" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {codes.length === 0 && <div className="p-4"><Empty>Промокодов нет</Empty></div>}
        </div>
      </Section>
    </div>
  );
}

/* ---------------------------------- ВЫПЛАТЫ --------------------------------- */
export async function Payouts() {
  const rows = await prisma.payoutRequest.findMany({
    orderBy: [{ createdAt: "desc" }], take: 100,
    include: { creator: { select: { displayName: true } }, history: { orderBy: { createdAt: "asc" } } },
  });
  return (
    <Section title="Выплаты" subtitle="Порядок: Ожидает → Одобрена → Выплачена (с идентификатором платежа). Выплаченные и отклонённые заявки неизменяемы.">
      {rows.length === 0 ? <Empty>Заявок на выплату нет</Empty> : (
        <div className="space-y-3">
          {rows.map((p) => (
            <div key={p.id} className="card space-y-3 p-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-semibold text-white">{p.creator.displayName}</span>
                <span className="text-lg font-bold text-gold-soft">{rub(p.amountKopecks)}</span>
                <StatusBadge status={p.status} />
                <span className="text-xs text-mute">{fmtDate(p.createdAt)}</span>
                {p.externalTxnId && <span className="font-mono text-xs text-mute">ID: {p.externalTxnId} · {fmtDate(p.paidAt)}</span>}
              </div>
              <div className="text-sm"><span className="text-mute">{p.method}:</span> <span className="font-mono">{p.details}</span></div>
              {p.adminComment && <div className="text-sm text-mute">Комментарий: {p.adminComment}</div>}
              <div className="flex flex-wrap gap-2">
                {p.status === "PENDING" && <ActionButton endpoint={`/api/admin/payouts/${p.id}`} body={{ action: "approve" }} label="Одобрить" className="btn-gold !py-1.5 text-xs" prompt={{ field: "comment", message: "Комментарий (необязательно):" }} />}
                {p.status === "PENDING" && (
                  <details className="inline-block">
                    <summary className="btn-ghost !py-1.5 text-xs cursor-pointer">Одобрить с другой суммой</summary>
                    <div className="mt-2 w-72"><ApiForm endpoint={`/api/admin/payouts/${p.id}`} extra={{ action: "approve" }} submitLabel="Одобрить" fields={[{ name: "amountKopecks", label: "Сумма, ₽ (не больше запрошенной)", type: "money", required: true }, { name: "comment", label: "Комментарий" }]} /></div>
                  </details>
                )}
                {p.status === "APPROVED" && (
                  <div className="w-full max-w-xl"><ApiForm endpoint={`/api/admin/payouts/${p.id}`} extra={{ action: "paid" }} submitLabel="Отметить как выплаченную" columns={2} fields={[{ name: "externalTxnId", label: "Идентификатор платежа (банк/СБП)", required: true }, { name: "comment", label: "Комментарий" }]} /></div>
                )}
                {(p.status === "PENDING" || p.status === "APPROVED") && <ActionButton endpoint={`/api/admin/payouts/${p.id}`} body={{ action: "reject" }} label="Отклонить" className="btn-danger !py-1.5 text-xs" prompt={{ field: "comment", message: "Причина отказа:", required: true }} />}
              </div>
              <ol className="space-y-0.5 border-l border-edge pl-3 text-xs text-mute">
                {p.history.map((h) => <li key={h.id}>{fmtDate(h.createdAt)}: {h.fromStatus ?? "—"} → <b className="text-zinc-300">{h.toStatus}</b> · {rub(h.amountKopecks)}{h.externalTxnId ? ` · ID ${h.externalTxnId}` : ""}{h.comment ? ` · ${h.comment}` : ""}</li>)}
              </ol>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

/* ------------------------------------ VIP ----------------------------------- */
export async function Vip({ q }: { q: string }) {
  const now = new Date();
  const [subs, perms, history, product, s] = await Promise.all([
    prisma.vipSubscription.findMany({
      where: q ? { minecraftAccount: { name: { contains: q, mode: "insensitive" } } } : { status: "ACTIVE", expiresAt: { gt: now } },
      orderBy: { expiresAt: "asc" }, take: 200, include: { minecraftAccount: { select: { name: true, uuid: true, user: { select: { username: true } } } } },
    }),
    prisma.vipPermission.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.vipGrantHistory.findMany({ orderBy: { createdAt: "desc" }, take: 30, include: { subscription: { include: { minecraftAccount: { select: { name: true } } } } } }),
    prisma.product.findFirst({ where: { type: "VIP" }, orderBy: { sortOrder: "asc" } }),
    getSettings(),
  ]);
  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Выдать / продлить / снять VIP" subtitle="Игрок должен привязать Minecraft-аккаунт на сайте.">
          <div className="card p-5">
            <ApiForm endpoint="/api/admin/vip" submitLabel="Выполнить" columns={2} resetOnSuccess fields={[
              { name: "action", label: "Действие", type: "select", options: [{ value: "grant", label: "Выдать / продлить" }, { value: "reduce", label: "Сократить срок" }, { value: "revoke", label: "Снять полностью" }] },
              { name: "player", label: "Ник Minecraft / имя на сайте", required: true },
              { name: "days", label: "Дней", type: "number", defaultValue: product?.durationDays ?? 30 },
              { name: "reason", label: "Причина (в журнал)", required: true },
            ]} />
          </div>
        </Section>
        <Section title="Цена и срок VIP" subtitle="Изменения не затрагивают уже созданные заказы.">
          <div className="card p-5">
            {product ? (
              <ApiForm endpoint={`/api/admin/products/${product.id}`} method="PATCH" submitLabel="Сохранить" columns={2} fields={[
                { name: "priceKopecks", label: "Цена, ₽", type: "money", defaultValue: product.priceKopecks / 100, required: true },
                { name: "durationDays", label: "Срок, дней", type: "number", defaultValue: product.durationDays, required: true },
                { name: "featuresRu", label: "Возможности (по строке)", type: "lines", defaultValue: product.featuresRu.join("\n") },
                { name: "featuresEn", label: "Features (one per line)", type: "lines", defaultValue: product.featuresEn.join("\n") },
              ]} />
            ) : <Empty>Товар VIP не найден — запустите seed.</Empty>}
          </div>
        </Section>
      </div>

      <Section title="Возможности и команды VIP" subtitle="Отключённые команды недоступны в игре после следующей синхронизации (≈30 с).">
        <div className="grid gap-2 md:grid-cols-3">
          {perms.map((p) => (
            <div key={p.key} className="card flex items-center justify-between gap-3 p-3">
              <div><div className="text-sm text-white">{p.labelRu}</div><div className="font-mono text-xs text-mute">{p.permission}</div></div>
              <ActionButton endpoint="/api/admin/vip-permissions" method="PATCH" body={{ key: p.key, enabled: !p.enabled }} label={p.enabled ? "Вкл" : "Выкл"} className={p.enabled ? "btn-gold !px-3 !py-1 text-xs" : "btn-ghost !px-3 !py-1 text-xs"} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Размер персонажа и лодки">
        <div className="card p-5">
          <ApiForm endpoint="/api/admin/settings" method="PUT" submitLabel="Сохранить" columns={3} extra={{}} fields={[
            { name: "vip", label: "Настройки VIP (JSON)", type: "json", defaultValue: JSON.stringify(s.vip, null, 2),
              help: "allowedScales — доступные размеры; boatMaxSpeeds — макс. скорость лодки (блоков/тик) для уровней I–III; combatNormalizeScale — сброс размера в PvP; rewardIntervalSeconds — интервал наград; maxStoredRewards — сколько наград можно накопить; afkTimeoutSeconds — через сколько секунд без действий игрок считается AFK; prefix — префикс VIP." },
          ]} />
        </div>
      </Section>

      <Section title={q ? `Подписки: «${q}»` : `Активные VIP (${subs.length})`} action={<Search tab="vip" q={q} placeholder="Ник игрока" />}>
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Игрок</th><th>Пользователь</th><th>Статус</th><th>С</th><th>До</th><th>Осталось</th></tr></thead>
            <tbody>
              {subs.map((x) => (
                <tr key={x.id}>
                  <td className="font-semibold">{x.minecraftAccount.name}</td>
                  <td className="text-mute">{x.minecraftAccount.user.username}</td>
                  <td><StatusBadge status={x.status === "ACTIVE" && x.expiresAt <= now ? "EXPIRED" : x.status} /></td>
                  <td className="text-xs">{fmtDate(x.startedAt)}</td>
                  <td className="text-xs">{fmtDate(x.expiresAt)}</td>
                  <td>{x.expiresAt > now ? `${Math.ceil((x.expiresAt.getTime() - now.getTime()) / 86400_000)} дн.` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {subs.length === 0 && <div className="p-4"><Empty>Нет подписок</Empty></div>}
        </div>
      </Section>

      <Section title="История выдачи VIP">
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Дата</th><th>Игрок</th><th>Действие</th><th>Дней</th><th>Было → стало</th><th>Причина</th></tr></thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td className="text-xs text-mute">{fmtDate(h.createdAt)}</td>
                  <td>{h.subscription.minecraftAccount.name}</td>
                  <td><Badge color={h.days < 0 || h.action === "REVOKE" ? "red" : "gold"}>{h.action}</Badge></td>
                  <td>{h.days}</td>
                  <td className="text-xs">{fmtDate(h.previousExpiresAt)} → {fmtDate(h.newExpiresAt)}</td>
                  <td className="text-xs text-mute">{h.reason ?? (h.purchaseId ? "покупка" : "")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

/* --------------------------------- НАГРАДЫ ---------------------------------- */
export async function Rewards() {
  const [rewards, history, s, playtime] = await Promise.all([
    prisma.vipReward.findMany({ orderBy: { weight: "desc" } }),
    prisma.rewardHistory.findMany({ orderBy: { claimedAt: "desc" }, take: 50 }),
    getSettings(),
    prisma.minecraftAccount.findMany({ where: { subscriptions: { some: { status: "ACTIVE" } } }, orderBy: { rewardProgressSeconds: "desc" }, take: 20, select: { name: true, activePlaytimeSeconds: true, rewardProgressSeconds: true, rewardsStored: true } }),
  ]);
  const tw = rewards.filter((r) => r.enabled).reduce((a, r) => a + r.weight, 0) || 1;
  return (
    <div className="space-y-8">
      <div className="card flex flex-wrap items-center gap-4 p-4 text-sm">
        <span>Награды: {s.vip.rewardsEnabled ? <Badge color="green">включены</Badge> : <Badge color="red">выключены</Badge>}</span>
        <span>Интервал: <b>{fmtDuration(s.vip.rewardIntervalSeconds)}</b></span>
        <span>Накопление: до <b>{s.vip.maxStoredRewards}</b></span>
        <ActionButton endpoint="/api/admin/settings" method="PUT" body={{ vip: { ...s.vip, rewardsEnabled: !s.vip.rewardsEnabled } }} label={s.vip.rewardsEnabled ? "Выключить награды" : "Включить награды"} className="btn-ghost !py-1.5 text-xs" />
        <span className="text-xs text-mute">Интервал меняется во вкладке VIP → JSON (rewardIntervalSeconds).</span>
      </div>

      <Section title="Наборы" subtitle="Вес — относительный шанс выпадения при обычном получении. Вес 0 — набор выдаётся только вручную или покупкой.">
        <div className="grid gap-4 lg:grid-cols-2">
          {[...rewards, null].map((r) => (
            <div key={r?.key ?? "new"} className="card p-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-semibold text-white">{r ? `${r.nameRu} · ${r.key}` : "Новый набор"}</span>
                {r && <span className="text-xs text-mute">{r.enabled && r.weight ? `${Math.round((r.weight / tw) * 100)}%` : "вручную"}</span>}
              </div>
              <RewardForm r={r} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Выдать награду вручную" subtitle="Игрок заберёт её командой /viprewards.">
        <div className="card p-5">
          <ApiForm endpoint="/api/admin/rewards/grant" submitLabel="Выдать" columns={2} resetOnSuccess fields={[
            { name: "player", label: "Ник Minecraft", required: true },
            { name: "rewardKey", label: "Набор", type: "select", options: rewards.map((r) => ({ value: r.key, label: r.nameRu })) },
            { name: "count", label: "Количество", type: "number", defaultValue: 1 },
            { name: "reason", label: "Причина", required: true },
          ]} />
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Прогресс VIP-игроков">
          <div className="card overflow-x-auto">
            <table className="table">
              <thead><tr><th>Игрок</th><th>Всего активно</th><th>До награды</th><th>Накоплено</th></tr></thead>
              <tbody>{playtime.map((p) => <tr key={p.name}><td>{p.name}</td><td>{fmtDuration(p.activePlaytimeSeconds)}</td><td>{fmtDuration(p.rewardProgressSeconds)} / {fmtDuration(s.vip.rewardIntervalSeconds)}</td><td>{p.rewardsStored}</td></tr>)}</tbody>
            </table>
          </div>
        </Section>
        <Section title="История выдачи наград">
          <div className="card overflow-x-auto">
            <table className="table">
              <thead><tr><th>Дата</th><th>Игрок</th><th>Набор</th><th>Источник</th></tr></thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="text-xs text-mute">{fmtDate(h.claimedAt)}</td>
                    <td>{h.playerName}</td>
                    <td title={(h.items as { material: string; amount: number }[]).map((i) => `${i.amount}× ${i.material}`).join(", ")}>{h.rewardKey}</td>
                    <td><Badge>{h.source}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {history.length === 0 && <div className="p-4"><Empty>Награды ещё не выдавались</Empty></div>}
          </div>
        </Section>
      </div>
    </div>
  );
}

function RewardForm({ r }: { r: { key: string; nameRu: string; nameEn: string; tier: string; weight: number; enabled: boolean; items: Prisma.JsonValue } | null }) {
  return (
    <RewardFormClient
      initial={r ? { key: r.key, nameRu: r.nameRu, nameEn: r.nameEn, tier: r.tier, weight: r.weight, enabled: r.enabled, items: JSON.stringify(r.items, null, 1) } : null}
    />
  );
}

/* ---------------------------------- ТОВАРЫ ---------------------------------- */
export async function Products() {
  const products = await prisma.product.findMany({ orderBy: { sortOrder: "asc" } });
  const productFields = (p?: (typeof products)[number]) => [
    ...(p ? [] : [{ name: "slug", label: "Slug (латиница)", required: true }]),
    { name: "type", label: "Тип", type: "select" as const, defaultValue: p?.type ?? "VIP", options: [{ value: "VIP", label: "VIP" }, { value: "VIP_GIFT", label: "VIP в подарок" }, { value: "REWARD_KIT", label: "Набор (в /viprewards)" }, { value: "COMMANDS", label: "Консольные команды" }] },
    { name: "category", label: "Категория (vip, privileges, cosmetics, gifts)", defaultValue: p?.category ?? "cosmetics", required: true },
    { name: "nameRu", label: "Название RU", defaultValue: p?.nameRu, required: true },
    { name: "nameEn", label: "Название EN", defaultValue: p?.nameEn, required: true },
    { name: "priceKopecks", label: "Цена, ₽", type: "money" as const, defaultValue: p ? p.priceKopecks / 100 : "", required: true },
    { name: "durationDays", label: "Срок, дней (для VIP)", type: "number" as const, defaultValue: p?.durationDays },
    { name: "image", label: "Изображение (/img/… или https://…)", defaultValue: p?.image ?? "/img/festive.svg" },
    { name: "sortOrder", label: "Порядок", type: "number" as const, defaultValue: p?.sortOrder ?? 10 },
    { name: "active", label: "Активен", type: "checkbox" as const, defaultValue: p?.active ?? true },
    { name: "descriptionRu", label: "Описание RU", type: "textarea" as const, defaultValue: p?.descriptionRu },
    { name: "descriptionEn", label: "Описание EN", type: "textarea" as const, defaultValue: p?.descriptionEn },
    { name: "featuresRu", label: "Возможности RU (по строке)", type: "lines" as const, defaultValue: p?.featuresRu.join("\n") },
    { name: "featuresEn", label: "Features EN (one per line)", type: "lines" as const, defaultValue: p?.featuresEn.join("\n") },
    { name: "payload", label: "Payload (JSON): {\"rewardKey\":\"festive\"} или {\"commands\":[\"give {player} cake 1\"]}", type: "json" as const, defaultValue: JSON.stringify(p?.payload ?? {}) },
  ];
  return (
    <div className="space-y-6">
      <p className="text-sm text-mute">Товары не должны давать боевых преимуществ. Команды COMMANDS выполняются от имени консоли сервера — указывайте только безопасные команды (плейсхолдеры: {"{player}"}, {"{uuid}"}).</p>
      {products.map((p) => (
        <details key={p.id} className="card p-5">
          <summary className="flex cursor-pointer flex-wrap items-center gap-3">
            <span className="font-semibold text-white">{p.nameRu}</span>
            <Badge>{p.type}</Badge>
            <span className="text-gold-soft">{rub(p.priceKopecks)}</span>
            {p.durationDays && <span className="text-xs text-mute">{p.durationDays} дн.</span>}
            {!p.active && <Badge color="red">скрыт</Badge>}
          </summary>
          <div className="mt-4"><ApiForm endpoint={`/api/admin/products/${p.id}`} method="PATCH" submitLabel="Сохранить" columns={3} fields={productFields(p)} /></div>
        </details>
      ))}
      <Section title="Новый товар">
        <div className="card p-5"><ApiForm endpoint="/api/admin/products" submitLabel="Создать" columns={3} resetOnSuccess fields={productFields()} /></div>
      </Section>
    </div>
  );
}

/* --------------------------------- НАСТРОЙКИ -------------------------------- */
export async function SettingsTab() {
  const s = await getSettings();
  return (
    <div className="space-y-6">
      <Section title="Партнёрская программа" subtitle="Изменения применяются к новым заказам. Ставка фиксируется в заказе в момент оформления.">
        <div className="card p-5">
          <ApiForm endpoint="/api/admin/settings" method="PUT" submitLabel="Сохранить" columns={3} fields={[
            { name: "commissionBps", label: "Стандартная комиссия, %", type: "percent", defaultValue: s.commissionBps / 100, required: true },
            { name: "discountBps", label: "Скидка по новым промокодам, %", type: "percent", defaultValue: s.discountBps / 100, required: true },
            { name: "holdDays", label: "Заморозка комиссии, дней", type: "number", defaultValue: s.holdDays, required: true },
            { name: "activePlayerBonusKopecks", label: "Бонус за активного игрока, ₽", type: "money", defaultValue: s.activePlayerBonusKopecks / 100, required: true },
            { name: "activePlayerMinSeconds", label: "Активный игрок: секунд игры", type: "number", defaultValue: s.activePlayerMinSeconds, required: true },
            { name: "minPayoutKopecks", label: "Минимальная выплата, ₽", type: "money", defaultValue: s.minPayoutKopecks / 100, required: true },
            { name: "milestones", label: "Достижения (JSON, суммы в копейках)", type: "json", defaultValue: JSON.stringify(s.milestones) },
            { name: "tierThresholds", label: "Пороги уровней за месяц (JSON, копейки)", type: "json", defaultValue: JSON.stringify(s.tierThresholds) },
            { name: "tierBonusBps", label: "Надбавка к комиссии по уровню (JSON, bps: 100 = 1%)", type: "json", defaultValue: JSON.stringify(s.tierBonusBps) },
          ]} />
        </div>
      </Section>
    </div>
  );
}

/* ------------------------------- ПОЛЬЗОВАТЕЛИ ------------------------------- */
export async function Users({ q, page }: { q: string; page: number }) {
  const where: Prisma.UserWhereInput = q ? { OR: [{ username: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { minecraftAccount: { name: { contains: q, mode: "insensitive" } } }] } : {};
  const users = await prisma.user.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE + 1, include: { minecraftAccount: true, referral: { include: { creator: { select: { displayName: true } } } } } });
  return (
    <Section title="Пользователи" action={<Search tab="users" q={q} placeholder="Имя, email или ник" />}>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Пользователь</th><th>Minecraft</th><th>Роль</th><th>Реферал</th><th>Регистрация</th><th></th></tr></thead>
          <tbody>
            {users.slice(0, PAGE).map((u) => (
              <tr key={u.id} className={u.isBlocked ? "opacity-50" : ""}>
                <td><b>{u.username}</b><div className="text-xs text-mute">{u.email}</div></td>
                <td>{u.minecraftAccount ? <>{u.minecraftAccount.name}<div className="text-xs text-mute">{fmtDuration(u.minecraftAccount.activePlaytimeSeconds)}</div></> : "—"}</td>
                <td><Badge color={u.role === "ADMIN" ? "red" : u.role === "CREATOR" ? "gold" : "gray"}>{u.role}</Badge></td>
                <td className="text-xs">{u.referral ? <>{u.referral.creator.displayName} <StatusBadge status={u.referral.status} />{u.referral.rejectReason && <div className="text-mute">{u.referral.rejectReason}</div>}</> : "—"}</td>
                <td className="text-xs text-mute">{fmtDate(u.createdAt)}</td>
                <td className="space-x-1 whitespace-nowrap">
                  {u.role !== "ADMIN" && <ActionButton endpoint={`/api/admin/users/${u.id}`} method="PATCH" body={{ role: "ADMIN" }} label="→ Админ" className="btn-ghost !px-2 !py-1 text-xs" confirm={`Выдать ${u.username} права администратора?`} />}
                  {u.role === "ADMIN" && <ActionButton endpoint={`/api/admin/users/${u.id}`} method="PATCH" body={{ role: "PLAYER" }} label="Снять админа" className="btn-ghost !px-2 !py-1 text-xs" confirm="Снять права администратора?" />}
                  <ActionButton endpoint={`/api/admin/users/${u.id}`} method="PATCH" body={{ isBlocked: !u.isBlocked }} label={u.isBlocked ? "Разблокировать" : "Блок"} className="btn-ghost !px-2 !py-1 text-xs" />
                  {u.minecraftAccount && <ActionButton endpoint={`/api/admin/users/${u.id}`} method="PATCH" body={{ unlinkMinecraft: true }} label="Отвязать MC" className="btn-ghost !px-2 !py-1 text-xs" confirm="Отвязать Minecraft-аккаунт?" />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager tab="users" q={q} page={page} hasMore={users.length > PAGE} />
    </Section>
  );
}

/* ---------------------------------- ЖУРНАЛ ---------------------------------- */
export async function Audit({ q, page }: { q: string; page: number }) {
  const where: Prisma.AuditLogWhereInput = q ? { OR: [{ action: { contains: q } }, { entityId: q }, { entityType: q }] } : {};
  const logs = await prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * 50, take: 51 });
  const actorIds = [...new Set(logs.map((l) => l.actorUserId).filter(Boolean))] as string[];
  const actors = new Map((await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, username: true } })).map((u) => [u.id, u.username]));
  return (
    <Section title="Журнал действий" subtitle="Записи журнала нельзя изменить или удалить (защищено на уровне базы данных)." action={<Search tab="audit" q={q} placeholder="Действие или ID объекта" />}>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Время</th><th>Кто</th><th>Действие</th><th>Объект</th><th>Данные</th></tr></thead>
          <tbody>
            {logs.slice(0, 50).map((l) => (
              <tr key={l.id}>
                <td className="whitespace-nowrap text-xs text-mute">{fmtDate(l.createdAt)}</td>
                <td className="text-xs">{l.actorType}{l.actorUserId ? <div className="text-zinc-300">{actors.get(l.actorUserId) ?? l.actorUserId.slice(0, 8)}</div> : null}</td>
                <td className="font-mono text-xs text-gold-soft">{l.action}</td>
                <td className="font-mono text-xs">{l.entityType}{l.entityId ? <div className="text-mute">{l.entityId}</div> : null}</td>
                <td className="max-w-md"><code className="block max-h-24 overflow-auto whitespace-pre-wrap break-all text-[11px] text-mute">{l.data ? JSON.stringify(l.data) : ""}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2">
        {page > 1 && <Link className="btn-ghost" href={`/admin?tab=audit&page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}>← Назад</Link>}
        {logs.length > 50 && <Link className="btn-ghost" href={`/admin?tab=audit&page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}>Далее →</Link>}
      </div>
    </Section>
  );
}
