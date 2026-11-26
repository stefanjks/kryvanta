process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || "postgresql://postgres@127.0.0.1:5432/kryvanta_test?schema=public";
process.env.APP_SECRET = "test-app-secret";
process.env.PLUGIN_API_SECRET = "test-plugin-secret";
process.env.PAYMENT_PROVIDER = "test";
process.env.TEST_PAYMENT_SECRET = "test-payment-secret";
process.env.APP_URL = "http://localhost:3000";
