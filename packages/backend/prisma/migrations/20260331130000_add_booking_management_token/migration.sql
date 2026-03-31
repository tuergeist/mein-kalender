-- AlterTable
ALTER TABLE "bookings" ADD COLUMN "managementToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "bookings_managementToken_key" ON "bookings"("managementToken");
