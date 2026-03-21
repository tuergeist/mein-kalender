-- AlterTable
ALTER TABLE "event_types" ADD COLUMN "shortHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "event_types_shortHash_key" ON "event_types"("shortHash");
