-- AlterTable: Reclaim-Termine optional aus der Slot-Berechnung der Buchungsseiten nehmen
ALTER TABLE "users" ADD COLUMN "ignoreReclaimTasks" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "ignoreReclaimHabits" BOOLEAN NOT NULL DEFAULT false;
