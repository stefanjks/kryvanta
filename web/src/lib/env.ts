/** Централизованное чтение переменных окружения. Секреты используются только на сервере. */
function req(name: string, fallbackForDev?: string): string {
  const v = process.env[name];
  if (v && v.length > 0) return v;
  if (process.env.NODE_ENV !== "production" && fallbackForDev !== undefined) return fallbackForDev;
  throw new Error(`Environment variable ${name} is required`);
}

export const env = {
  get appUrl() { return req("APP_URL", "http://localhost:3000").replace(/\/$/, ""); },
  get appSecret() { return req("APP_SECRET", "dev-app-secret-change-me"); },
  get pluginSecret() { return req("PLUGIN_API_SECRET", "dev-plugin-secret-change-me"); },
  get paymentProvider() { return (process.env.PAYMENT_PROVIDER || "manual").toLowerCase(); },
  get allowTestPayments() {
    return process.env.NODE_ENV !== "production" || process.env.ALLOW_TEST_PAYMENTS === "true";
  },
  get testPaymentSecret() { return req("TEST_PAYMENT_SECRET", "dev-test-payment-secret"); },
  get yookassaShopId() { return process.env.YOOKASSA_SHOP_ID || ""; },
  get yookassaSecretKey() { return process.env.YOOKASSA_SECRET_KEY || ""; },
  get yookassaAllowedIps() {
    return (process.env.YOOKASSA_ALLOWED_IPS || "").split(",").map((s) => s.trim()).filter(Boolean);
  },
  get trustProxy() { return process.env.TRUST_PROXY !== "false"; },
  get isProd() { return process.env.NODE_ENV === "production"; },
};

export const publicConfig = {
  serverIp: process.env.NEXT_PUBLIC_SERVER_IP || "m3.nexuz.ru:41058",
  discordUrl: process.env.NEXT_PUBLIC_DISCORD_URL || "https://discord.gg/bsrudxHwV",
  mcVersion: process.env.NEXT_PUBLIC_MC_VERSION || "1.21.11",
};
