-- AlterTable: Add adaptive backoff fields to calendar_sources
ALTER TABLE "calendar_sources"
  ADD COLUMN "nextSyncAfter" TIMESTAMP(3),
  ADD COLUMN "consecutiveErrors" INTEGER NOT NULL DEFAULT 0;
