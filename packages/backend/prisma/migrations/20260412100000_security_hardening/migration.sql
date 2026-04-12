-- AlterTable: Add email verification fields to users
ALTER TABLE "users" ADD COLUMN "emailVerificationToken" TEXT,
ADD COLUMN "emailVerificationExpiresAt" TIMESTAMP(3);

-- CreateIndex: unique on email verification token
CREATE UNIQUE INDEX "users_emailVerificationToken_key" ON "users"("emailVerificationToken");

-- AlterTable: Add management token expiration to bookings
ALTER TABLE "bookings" ADD COLUMN "managementTokenExpiresAt" TIMESTAMP(3);

-- CreateTable: PaymentEvent for idempotent webhook processing
CREATE TABLE "payment_events" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_events_paymentId_key" ON "payment_events"("paymentId");
