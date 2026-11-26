import { execSync } from "node:child_process";

/**
 * Интеграционные тесты работают с настоящим PostgreSQL.
 * TEST_DATABASE_URL должен указывать на отдельную тестовую БД — она будет пересоздана.
 */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL || "postgresql://postgres@127.0.0.1:5432/kryvanta_test?schema=public";
  if (!/test/i.test(url)) throw new Error("TEST_DATABASE_URL must point to a *test* database");
  process.env.DATABASE_URL = url;
  const env = { ...process.env, DATABASE_URL: url, SEED_ADMIN_EMAIL: "root@test.local", SEED_ADMIN_USERNAME: "root", SEED_ADMIN_PASSWORD: "root-password-123" };
  const u = new URL(url);
  const db = u.pathname.slice(1);
  u.pathname = "/postgres";
  const admin = u.toString().replace(/\?.*$/, "");
  execSync(`psql "${admin}" -q -c "DROP DATABASE IF EXISTS ${db} WITH (FORCE)" -c "CREATE DATABASE ${db}"`, { stdio: "inherit", env });
  execSync("npx prisma migrate deploy", { stdio: "ignore", env });
  execSync("npx tsx prisma/seed.ts", { stdio: "ignore", env });
}
