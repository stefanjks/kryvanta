#!/usr/bin/env bash
# Сборка на Vercel: миграции → начальные данные → сборка сайта.
set -euo pipefail
# Интеграция Neon даёт DATABASE_URL через пулер; миграции выполняем по прямому подключению.
if [ -n "${DATABASE_URL_UNPOOLED:-}" ]; then export DATABASE_URL="$DATABASE_URL_UNPOOLED"; fi
if [ -z "${DATABASE_URL:-}" ]; then
  echo "ОШИБКА: не задан DATABASE_URL. Подключите базу: Vercel → Storage → Neon (или добавьте переменную вручную)." >&2
  exit 1
fi
npx prisma generate
npx prisma migrate deploy
npx tsx prisma/seed.ts
npx next build
