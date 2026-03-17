-- AlterTable: Add bookingCalendarEntryId to event_types
ALTER TABLE "event_types" ADD COLUMN "bookingCalendarEntryId" TEXT;

-- AlterTable: Add eventTypeId to availability_rules
ALTER TABLE "availability_rules" ADD COLUMN "eventTypeId" TEXT;

-- Drop old unique constraint
ALTER TABLE "availability_rules" DROP CONSTRAINT IF EXISTS "availability_rules_userId_dayOfWeek_key";

-- Create new unique constraint (nullable eventTypeId handled by Prisma)
CREATE UNIQUE INDEX "availability_rules_userId_eventTypeId_dayOfWeek_key" ON "availability_rules"("userId", "eventTypeId", "dayOfWeek");

-- AddForeignKey
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_eventTypeId_fkey" FOREIGN KEY ("eventTypeId") REFERENCES "event_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
