-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PLAYER', 'CREATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED', 'REFUNDED', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'CANCELLED', 'REFUNDED', 'FAILED');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('VIP', 'VIP_GIFT', 'REWARD_KIT', 'COMMANDS');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "CreatorStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "CreatorTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'DIAMOND');

-- CreateEnum
CREATE TYPE "CommissionType" AS ENUM ('SALE', 'ACTIVE_PLAYER_BONUS', 'MILESTONE_BONUS', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('HOLD', 'AVAILABLE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'QUALIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'REJECTED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'DELIVERED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'PLAYER',
    "locale" TEXT NOT NULL DEFAULT 'ru',
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "registrationIpHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipHash" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "minecraft_accounts" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "uuid" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activePlaytimeSeconds" INTEGER NOT NULL DEFAULT 0,
    "lastSeenAt" TIMESTAMP(3),

    CONSTRAINT "minecraft_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "minecraft_uuid_history" (
    "uuid" UUID NOT NULL,
    "firstUserId" UUID NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "minecraft_uuid_history_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "link_codes" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "link_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "ProductType" NOT NULL,
    "category" TEXT NOT NULL,
    "nameRu" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "descriptionRu" TEXT NOT NULL DEFAULT '',
    "descriptionEn" TEXT NOT NULL DEFAULT '',
    "image" TEXT NOT NULL DEFAULT '/img/vip.svg',
    "priceKopecks" INTEGER NOT NULL,
    "durationDays" INTEGER,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "featuresRu" TEXT[],
    "featuresEn" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vip_subscriptions" (
    "id" UUID NOT NULL,
    "minecraftAccountId" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vip_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vip_grant_history" (
    "id" UUID NOT NULL,
    "subscriptionId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "days" INTEGER NOT NULL DEFAULT 0,
    "previousExpiresAt" TIMESTAMP(3),
    "newExpiresAt" TIMESTAMP(3),
    "purchaseId" UUID,
    "actorUserId" UUID,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vip_grant_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vip_permissions" (
    "key" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "labelRu" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vip_permissions_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "vip_rewards" (
    "key" TEXT NOT NULL,
    "nameRu" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 0,
    "items" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vip_rewards_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "reward_history" (
    "id" UUID NOT NULL,
    "claimId" UUID NOT NULL,
    "playerUuid" UUID NOT NULL,
    "playerName" TEXT NOT NULL,
    "rewardKey" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reward_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creator_applications" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "displayName" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "channelUrl" TEXT NOT NULL,
    "audience" INTEGER NOT NULL,
    "message" TEXT NOT NULL DEFAULT '',
    "status" "CreatorStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" UUID,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "creator_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creators" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "socials" JSONB NOT NULL DEFAULT '{}',
    "status" "CreatorStatus" NOT NULL DEFAULT 'APPROVED',
    "tier" "CreatorTier" NOT NULL DEFAULT 'BRONZE',
    "commissionBps" INTEGER,
    "activeBonusKopecks" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creator_codes" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "creatorId" UUID NOT NULL,
    "discountBps" INTEGER NOT NULL DEFAULT 1000,
    "maxUses" INTEGER,
    "usesCount" INTEGER NOT NULL DEFAULT 0,
    "onePerUser" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creator_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrals" (
    "id" UUID NOT NULL,
    "creatorId" UUID NOT NULL,
    "referredUserId" UUID NOT NULL,
    "codeUsed" TEXT NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "rejectReason" TEXT,
    "qualifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_events" (
    "id" UUID NOT NULL,
    "creatorId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "code" TEXT,
    "ipHash" TEXT,
    "userId" UUID,
    "dedupeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchases" (
    "id" UUID NOT NULL,
    "orderNumber" SERIAL NOT NULL,
    "userId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "recipientUuid" UUID NOT NULL,
    "recipientName" TEXT NOT NULL,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "basePriceKopecks" INTEGER NOT NULL,
    "discountKopecks" INTEGER NOT NULL DEFAULT 0,
    "amountKopecks" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "creatorCodeId" UUID,
    "creatorId" UUID,
    "commissionBps" INTEGER,
    "durationDays" INTEGER,
    "paidAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "purchaseId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "providerPaymentId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amountKopecks" INTEGER NOT NULL,
    "confirmationUrl" TEXT,
    "rawLast" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_events" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commissions" (
    "id" UUID NOT NULL,
    "creatorId" UUID NOT NULL,
    "type" "CommissionType" NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'HOLD',
    "amountKopecks" INTEGER NOT NULL,
    "baseKopecks" INTEGER,
    "rateBps" INTEGER,
    "purchaseId" UUID,
    "referralId" UUID,
    "operationKey" TEXT NOT NULL,
    "availableAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdBy" UUID,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_requests" (
    "id" UUID NOT NULL,
    "creatorId" UUID NOT NULL,
    "amountKopecks" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "adminComment" TEXT,
    "paidAmountKopecks" INTEGER,
    "externalTxnId" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payout_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_history" (
    "id" UUID NOT NULL,
    "payoutRequestId" UUID NOT NULL,
    "fromStatus" "PayoutStatus",
    "toStatus" "PayoutStatus" NOT NULL,
    "amountKopecks" INTEGER NOT NULL,
    "externalTxnId" TEXT,
    "comment" TEXT,
    "actorUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payout_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" UUID,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actorUserId" UUID,
    "actorType" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "data" JSONB,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_deliveries" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "playerUuid" UUID,
    "payload" JSONB NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "plugin_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_nonces" (
    "nonce" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_nonces_pkey" PRIMARY KEY ("nonce")
);

-- CreateTable
CREATE TABLE "playtime_batches" (
    "batchId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "playtime_batches_pkey" PRIMARY KEY ("batchId")
);

-- CreateTable
CREATE TABLE "server_status" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "online" INTEGER NOT NULL DEFAULT 0,
    "maxPlayers" INTEGER NOT NULL DEFAULT 0,
    "version" TEXT,
    "heartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "server_status_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "minecraft_accounts_userId_key" ON "minecraft_accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "minecraft_accounts_uuid_key" ON "minecraft_accounts"("uuid");

-- CreateIndex
CREATE INDEX "minecraft_accounts_name_idx" ON "minecraft_accounts"("name");

-- CreateIndex
CREATE UNIQUE INDEX "link_codes_codeHash_key" ON "link_codes"("codeHash");

-- CreateIndex
CREATE INDEX "link_codes_userId_idx" ON "link_codes"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "vip_subscriptions_minecraftAccountId_key" ON "vip_subscriptions"("minecraftAccountId");

-- CreateIndex
CREATE INDEX "vip_subscriptions_status_expiresAt_idx" ON "vip_subscriptions"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "vip_grant_history_subscriptionId_idx" ON "vip_grant_history"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "reward_history_claimId_key" ON "reward_history"("claimId");

-- CreateIndex
CREATE INDEX "reward_history_playerUuid_idx" ON "reward_history"("playerUuid");

-- CreateIndex
CREATE INDEX "reward_history_claimedAt_idx" ON "reward_history"("claimedAt");

-- CreateIndex
CREATE INDEX "creator_applications_status_idx" ON "creator_applications"("status");

-- CreateIndex
CREATE UNIQUE INDEX "creators_userId_key" ON "creators"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "creator_codes_code_key" ON "creator_codes"("code");

-- CreateIndex
CREATE INDEX "creator_codes_creatorId_idx" ON "creator_codes"("creatorId");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_referredUserId_key" ON "referrals"("referredUserId");

-- CreateIndex
CREATE INDEX "referrals_creatorId_status_idx" ON "referrals"("creatorId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "referral_events_dedupeKey_key" ON "referral_events"("dedupeKey");

-- CreateIndex
CREATE INDEX "referral_events_creatorId_type_createdAt_idx" ON "referral_events"("creatorId", "type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "purchases_orderNumber_key" ON "purchases"("orderNumber");

-- CreateIndex
CREATE INDEX "purchases_userId_idx" ON "purchases"("userId");

-- CreateIndex
CREATE INDEX "purchases_creatorId_status_idx" ON "purchases"("creatorId", "status");

-- CreateIndex
CREATE INDEX "purchases_status_paidAt_idx" ON "purchases"("status", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotencyKey_key" ON "payments"("idempotencyKey");

-- CreateIndex
CREATE INDEX "payments_purchaseId_idx" ON "payments"("purchaseId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_providerPaymentId_key" ON "payments"("provider", "providerPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_events_provider_eventKey_key" ON "payment_events"("provider", "eventKey");

-- CreateIndex
CREATE UNIQUE INDEX "commissions_operationKey_key" ON "commissions"("operationKey");

-- CreateIndex
CREATE INDEX "commissions_creatorId_status_idx" ON "commissions"("creatorId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payout_requests_externalTxnId_key" ON "payout_requests"("externalTxnId");

-- CreateIndex
CREATE INDEX "payout_requests_creatorId_status_idx" ON "payout_requests"("creatorId", "status");

-- CreateIndex
CREATE INDEX "payout_history_payoutRequestId_idx" ON "payout_history"("payoutRequestId");

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "plugin_deliveries_status_createdAt_idx" ON "plugin_deliveries"("status", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "api_nonces_createdAt_idx" ON "api_nonces"("createdAt");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "minecraft_accounts" ADD CONSTRAINT "minecraft_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "link_codes" ADD CONSTRAINT "link_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vip_subscriptions" ADD CONSTRAINT "vip_subscriptions_minecraftAccountId_fkey" FOREIGN KEY ("minecraftAccountId") REFERENCES "minecraft_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vip_grant_history" ADD CONSTRAINT "vip_grant_history_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "vip_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_applications" ADD CONSTRAINT "creator_applications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creators" ADD CONSTRAINT "creators_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_codes" ADD CONSTRAINT "creator_codes_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "creators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "creators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_events" ADD CONSTRAINT "referral_events_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "creators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_creatorCodeId_fkey" FOREIGN KEY ("creatorCodeId") REFERENCES "creator_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "creators"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "creators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_requests" ADD CONSTRAINT "payout_requests_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "creators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_history" ADD CONSTRAINT "payout_history_payoutRequestId_fkey" FOREIGN KEY ("payoutRequestId") REFERENCES "payout_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
