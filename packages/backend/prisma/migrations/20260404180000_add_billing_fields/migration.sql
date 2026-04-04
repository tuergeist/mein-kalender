-- AlterTable
ALTER TABLE "users" ADD COLUMN "mollieCustomerId" TEXT;
ALTER TABLE "users" ADD COLUMN "subscriptionId" TEXT;
ALTER TABLE "users" ADD COLUMN "subscriptionStatus" TEXT;
ALTER TABLE "users" ADD COLUMN "subscriptionPlan" TEXT;
ALTER TABLE "users" ADD COLUMN "trialEndsAt" TIMESTAMP(3);
