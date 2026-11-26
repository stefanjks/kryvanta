# Размещение сайта: Neon (база данных) + Vercel (сайт)

Neon хранит только базу данных PostgreSQL. Сам сайт размещается на **Vercel** (бесплатный тариф Hobby),
который берёт код прямо из GitHub-репозитория. Терминал не нужен — всё делается в браузере.

## 1. Neon — база данных
1. https://console.neon.tech → **New Project**. Имя: `kryvanta`, Postgres 16, регион **AWS Europe Central (Frankfurt)**.
2. На странице проекта нажмите **Connect**. Выключите переключатель **Connection pooling**
   (нужна прямая строка — адрес *без* `-pooler`). Скопируйте строку вида
   `postgresql://neondb_owner:ПАРОЛЬ@ep-xxxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`.
3. Допишите в конец `&connect_timeout=15` — это и будет `DATABASE_URL`.
   Никому не отправляйте эту строку: в ней пароль от базы.

## 2. Vercel — сайт
1. https://vercel.com → **Sign up with GitHub** (тот же аккаунт, где репозиторий `kryvanta`).
2. **Add New… → Project → Import** репозиторий `stefanjks/kryvanta`.
3. **Root Directory** → `web` (обязательно). Framework определится сам: Next.js.
4. Пока изменения не слиты в `main`, в настройках проекта выберите ветку
   `claude/kryvanta-ecosystem-f3tq6x` (Settings → Git → Production Branch) или сначала слейте её в `main`.
5. **Environment Variables** — добавьте:

| Имя | Значение |
|---|---|
| `DATABASE_URL` | строка из Neon (шаг 1.3) |
| `APP_URL` | `https://<имя-проекта>.vercel.app` (после первого деплоя видно в Vercel; потом — ваш домен) |
| `APP_SECRET` | случайная строка 64 символа |
| `PLUGIN_API_SECRET` | случайная строка 64 символа (её же — в `plugins/Kryvanta/config.yml`) |
| `CRON_SECRET` | случайная строка 64 символа |
| `TEST_PAYMENT_SECRET` | случайная строка 64 символа |
| `PAYMENT_PROVIDER` | `manual` (заказы подтверждаются в админ-панели, пока нет ЮKassa) |
| `TRUST_PROXY` | `true` |
| `SEED_ADMIN_EMAIL` | ваш email для входа в админку |
| `SEED_ADMIN_USERNAME` | например `admin` |
| `SEED_ADMIN_PASSWORD` | надёжный пароль от 10 символов |
| `NEXT_PUBLIC_SERVER_IP` | `m3.nexuz.ru:41058` |
| `NEXT_PUBLIC_DISCORD_URL` | `https://discord.gg/bsrudxHwV` |
| `NEXT_PUBLIC_MC_VERSION` | `1.21.11` |

   Случайные строки: https://www.random.org/strings/ (или `openssl rand -hex 32`). Для каждой — своя.
6. **Deploy**. Во время сборки автоматически: создаются таблицы в Neon (`prisma migrate deploy`),
   добавляются товары/наборы и создаётся администратор (`seed`), собирается сайт.
7. Если `APP_URL` при первом деплое был неизвестен — впишите его и нажмите **Redeploy**.

## 3. Проверка
* Откройте сайт → **Войти** с `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` → в шапке появится «Админ».
* В Vercel → Settings → Cron Jobs виден ежедневный `/api/cron/maintenance` (окончание VIP также
  проверяется при каждой синхронизации с плагином, раз в 30 с).

## 4. Подключение Minecraft-сервера
В `plugins/Kryvanta/config.yml`:
```yaml
api:
  url: "https://<имя-проекта>.vercel.app"
  secret: "<PLUGIN_API_SECRET>"
```
`/kryvanta reload` → `/kvip status` должно показать «сайт доступен».

## 5. Свой домен (по желанию)
Vercel → Settings → Domains → добавить `kryvanta.ru`, прописать DNS-записи, которые покажет Vercel,
затем поменять `APP_URL` и `api.url` в плагине на новый адрес и сделать Redeploy.

## Ограничения бесплатных тарифов
* Vercel Hobby — для некоммерческого использования; для магазина с реальными платежами Vercel требует тариф Pro.
  Альтернатива — свой VPS (README, раздел 2), база может остаться в Neon.
* Rate limiting хранится в памяти каждого экземпляра функции — на Vercel он мягче, чем на одном сервере.
* Neon Free «засыпает» без запросов; первый запрос после паузы может занять пару секунд.
