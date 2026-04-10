-- AlterTable
ALTER TABLE "calendar_sources" ADD COLUMN "emailForInvitations" TEXT;

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN "icsUid" TEXT;
ALTER TABLE "bookings" ADD COLUMN "icsSequence" INTEGER NOT NULL DEFAULT 0;
