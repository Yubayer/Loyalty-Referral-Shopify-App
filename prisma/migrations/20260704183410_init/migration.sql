-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" SERIAL NOT NULL,
    "shopifyId" TEXT NOT NULL,
    "name" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "orders" INTEGER NOT NULL DEFAULT 0,
    "lifetimePoints" INTEGER NOT NULL DEFAULT 0,
    "referralCode" TEXT NOT NULL,
    "birthday" TIMESTAMP(3),
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "activeStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sessionId" TEXT NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" SERIAL NOT NULL,
    "shop" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sessionId" TEXT,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointsRule" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "pointsType" TEXT NOT NULL DEFAULT 'FIXED',
    "pointsValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxPoints" INTEGER,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "minOrderAmount" DOUBLE PRECISION,
    "maxUsesPerUser" INTEGER,
    "conditions" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sessionId" TEXT NOT NULL,
    "eventId" INTEGER NOT NULL,

    CONSTRAINT "PointsRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardRule" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "pointsCost" INTEGER NOT NULL,
    "discountType" TEXT NOT NULL,
    "rewardType" TEXT NOT NULL,
    "rewardValue" DOUBLE PRECISION,
    "couponPrefix" TEXT,
    "usageLimit" INTEGER,
    "usagePerUser" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "isAutoApply" BOOLEAN NOT NULL DEFAULT false,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "minOrderAmount" DOUBLE PRECISION,
    "conditions" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sessionId" TEXT NOT NULL,

    CONSTRAINT "RewardRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "eventId" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "activity" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "pointsRuleId" INTEGER,
    "rewardId" INTEGER,
    "referralId" INTEGER,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" SERIAL NOT NULL,
    "referrerId" INTEGER NOT NULL,
    "referredId" INTEGER NOT NULL,
    "orderId" TEXT,
    "status" TEXT DEFAULT 'PENDING',
    "discountCode" TEXT,
    "discountInfo" TEXT,
    "discountUsed" BOOLEAN NOT NULL DEFAULT false,
    "rewardGiven" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "subscriptionContractId" TEXT,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reward" (
    "id" SERIAL NOT NULL,
    "title" TEXT,
    "event" TEXT,
    "type" TEXT DEFAULT 'DEFAULT',
    "code" TEXT,
    "rewardKey" TEXT,
    "orderId" TEXT,
    "pointsCost" INTEGER,
    "status" TEXT DEFAULT 'PENDING',
    "discountUsed" BOOLEAN NOT NULL DEFAULT false,
    "usedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rewardRuleId" INTEGER,
    "customerId" INTEGER NOT NULL,

    CONSTRAINT "Reward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "topic" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PROCESSED',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" SERIAL NOT NULL,
    "shop" TEXT NOT NULL,
    "settings" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sessionId" TEXT NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Style" (
    "id" SERIAL NOT NULL,
    "shop" TEXT NOT NULL,
    "actionButton" JSONB,
    "header" JSONB,
    "tabHome" JSONB,
    "tabRewards" JSONB,
    "tabActivity" JSONB,
    "tabProfile" JSONB,
    "tabReferral" JSONB,
    "tabEarnPoints" JSONB,
    "accountActivity" JSONB,
    "cssVars" JSONB,
    "presetKey" TEXT,
    "widgetConfig" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sessionId" TEXT NOT NULL,

    CONSTRAINT "Style_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhysicalPrize" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "pointsCost" INTEGER NOT NULL,
    "productValue" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sessionId" TEXT NOT NULL,

    CONSTRAINT "PhysicalPrize_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhysicalPrizeClaim" (
    "id" SERIAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "pointsCost" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fulfilledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "customerId" INTEGER NOT NULL,
    "physicalPrizeId" INTEGER NOT NULL,
    "transactionId" INTEGER,
    "isSeenByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "viewedByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "viewedAt" TIMESTAMP(3),
    "adminNote" TEXT,
    "trackingInfo" TEXT,

    CONSTRAINT "PhysicalPrizeClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobLock" (
    "id" SERIAL NOT NULL,
    "jobName" TEXT NOT NULL,
    "isRunning" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobLock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "shop" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "idempotencyKey" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "autoRetryCount" INTEGER NOT NULL DEFAULT 0,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Session_shop_key" ON "Session"("shop");

-- CreateIndex
CREATE INDEX "Session_shop_idx" ON "Session"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_shopifyId_key" ON "Customer"("shopifyId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_referralCode_key" ON "Customer"("referralCode");

-- CreateIndex
CREATE INDEX "Customer_sessionId_idx" ON "Customer"("sessionId");

-- CreateIndex
CREATE INDEX "Customer_referralCode_idx" ON "Customer"("referralCode");

-- CreateIndex
CREATE INDEX "Customer_activeStatus_idx" ON "Customer"("activeStatus");

-- CreateIndex
CREATE INDEX "Customer_sessionId_enrolledAt_idx" ON "Customer"("sessionId", "enrolledAt" DESC);

-- CreateIndex
CREATE INDEX "Customer_sessionId_points_idx" ON "Customer"("sessionId", "points" DESC);

-- CreateIndex
CREATE INDEX "Customer_sessionId_name_idx" ON "Customer"("sessionId", "name");

-- CreateIndex
CREATE INDEX "Customer_sessionId_email_idx" ON "Customer"("sessionId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_sessionId_email_key" ON "Customer"("sessionId", "email");

-- CreateIndex
CREATE INDEX "Event_shop_idx" ON "Event"("shop");

-- CreateIndex
CREATE INDEX "Event_type_idx" ON "Event"("type");

-- CreateIndex
CREATE INDEX "Event_isActive_idx" ON "Event"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Event_sessionId_type_key" ON "Event"("sessionId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Event_shop_type_key" ON "Event"("shop", "type");

-- CreateIndex
CREATE UNIQUE INDEX "PointsRule_eventId_key" ON "PointsRule"("eventId");

-- CreateIndex
CREATE INDEX "PointsRule_sessionId_idx" ON "PointsRule"("sessionId");

-- CreateIndex
CREATE INDEX "PointsRule_isActive_idx" ON "PointsRule"("isActive");

-- CreateIndex
CREATE INDEX "PointsRule_priority_idx" ON "PointsRule"("priority");

-- CreateIndex
CREATE INDEX "RewardRule_sessionId_idx" ON "RewardRule"("sessionId");

-- CreateIndex
CREATE INDEX "RewardRule_isActive_idx" ON "RewardRule"("isActive");

-- CreateIndex
CREATE INDEX "RewardRule_priority_idx" ON "RewardRule"("priority");

-- CreateIndex
CREATE INDEX "Transaction_customerId_idx" ON "Transaction"("customerId");

-- CreateIndex
CREATE INDEX "Transaction_customerId_createdAt_idx" ON "Transaction"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_customerId_type_idx" ON "Transaction"("customerId", "type");

-- CreateIndex
CREATE INDEX "Transaction_customerId_notifiedAt_idx" ON "Transaction"("customerId", "notifiedAt");

-- CreateIndex
CREATE INDEX "Transaction_eventId_idx" ON "Transaction"("eventId");

-- CreateIndex
CREATE INDEX "Transaction_rewardId_idx" ON "Transaction"("rewardId");

-- CreateIndex
CREATE INDEX "Transaction_referralId_idx" ON "Transaction"("referralId");

-- CreateIndex
CREATE INDEX "Transaction_expiresAt_idx" ON "Transaction"("expiresAt");

-- CreateIndex
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");

-- CreateIndex
CREATE INDEX "Referral_referrerId_idx" ON "Referral"("referrerId");

-- CreateIndex
CREATE INDEX "Referral_status_idx" ON "Referral"("status");

-- CreateIndex
CREATE INDEX "Referral_discountCode_idx" ON "Referral"("discountCode");

-- CreateIndex
CREATE INDEX "Referral_subscriptionContractId_idx" ON "Referral"("subscriptionContractId");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_referredId_key" ON "Referral"("referredId");

-- CreateIndex
CREATE UNIQUE INDEX "Reward_rewardKey_key" ON "Reward"("rewardKey");

-- CreateIndex
CREATE INDEX "Reward_customerId_idx" ON "Reward"("customerId");

-- CreateIndex
CREATE INDEX "Reward_rewardRuleId_idx" ON "Reward"("rewardRuleId");

-- CreateIndex
CREATE INDEX "Reward_status_idx" ON "Reward"("status");

-- CreateIndex
CREATE INDEX "Reward_expiresAt_idx" ON "Reward"("expiresAt");

-- CreateIndex
CREATE INDEX "Reward_code_idx" ON "Reward"("code");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_eventKey_key" ON "WebhookEvent"("eventKey");

-- CreateIndex
CREATE INDEX "WebhookEvent_shop_idx" ON "WebhookEvent"("shop");

-- CreateIndex
CREATE INDEX "WebhookEvent_createdAt_idx" ON "WebhookEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AppSettings_sessionId_key" ON "AppSettings"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "AppSettings_shop_key" ON "AppSettings"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "Style_sessionId_key" ON "Style"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Style_shop_key" ON "Style"("shop");

-- CreateIndex
CREATE INDEX "PhysicalPrize_sessionId_idx" ON "PhysicalPrize"("sessionId");

-- CreateIndex
CREATE INDEX "PhysicalPrize_isActive_idx" ON "PhysicalPrize"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PhysicalPrizeClaim_transactionId_key" ON "PhysicalPrizeClaim"("transactionId");

-- CreateIndex
CREATE INDEX "PhysicalPrizeClaim_customerId_idx" ON "PhysicalPrizeClaim"("customerId");

-- CreateIndex
CREATE INDEX "PhysicalPrizeClaim_physicalPrizeId_idx" ON "PhysicalPrizeClaim"("physicalPrizeId");

-- CreateIndex
CREATE INDEX "PhysicalPrizeClaim_status_idx" ON "PhysicalPrizeClaim"("status");

-- CreateIndex
CREATE UNIQUE INDEX "JobLock_jobName_key" ON "JobLock"("jobName");

-- CreateIndex
CREATE UNIQUE INDEX "Job_idempotencyKey_key" ON "Job"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Job_status_runAt_idx" ON "Job"("status", "runAt");

-- CreateIndex
CREATE INDEX "Job_status_lockedAt_idx" ON "Job"("status", "lockedAt");

-- CreateIndex
CREATE INDEX "Job_shop_idx" ON "Job"("shop");

-- CreateIndex
CREATE INDEX "Job_type_status_idx" ON "Job"("type", "status");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointsRule" ADD CONSTRAINT "PointsRule_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointsRule" ADD CONSTRAINT "PointsRule_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardRule" ADD CONSTRAINT "RewardRule_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_pointsRuleId_fkey" FOREIGN KEY ("pointsRuleId") REFERENCES "PointsRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "Reward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "Referral"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referredId_fkey" FOREIGN KEY ("referredId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reward" ADD CONSTRAINT "Reward_rewardRuleId_fkey" FOREIGN KEY ("rewardRuleId") REFERENCES "RewardRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reward" ADD CONSTRAINT "Reward_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppSettings" ADD CONSTRAINT "AppSettings_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Style" ADD CONSTRAINT "Style_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhysicalPrize" ADD CONSTRAINT "PhysicalPrize_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhysicalPrizeClaim" ADD CONSTRAINT "PhysicalPrizeClaim_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhysicalPrizeClaim" ADD CONSTRAINT "PhysicalPrizeClaim_physicalPrizeId_fkey" FOREIGN KEY ("physicalPrizeId") REFERENCES "PhysicalPrize"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhysicalPrizeClaim" ADD CONSTRAINT "PhysicalPrizeClaim_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
