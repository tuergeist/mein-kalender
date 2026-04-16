-- AlterTable: Add buffer time defaults to users
ALTER TABLE "users" ADD COLUMN "defaultBufferBeforeMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "defaultBufferAfterMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "applyBuffersToAllEvents" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Add buffer time fields to event types
ALTER TABLE "event_types" ADD COLUMN "bufferBeforeMinutes" INTEGER,
ADD COLUMN "bufferAfterMinutes" INTEGER;
