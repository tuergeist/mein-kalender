-- CreateTable
CREATE TABLE "sync_health" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventsProcessed" INTEGER NOT NULL DEFAULT 0,
    "eventsFailed" INTEGER NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "checksumMatch" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_health_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conflicts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventAId" TEXT NOT NULL,
    "eventBId" TEXT NOT NULL,
    "eventATitle" TEXT NOT NULL,
    "eventBTitle" TEXT NOT NULL,
    "eventAStart" TIMESTAMP(3) NOT NULL,
    "eventBStart" TIMESTAMP(3) NOT NULL,
    "eventASource" TEXT NOT NULL,
    "eventBSource" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "conflicts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_page_views" (
    "id" TEXT NOT NULL,
    "eventTypeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "booking_page_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sync_health_userId_createdAt_idx" ON "sync_health"("userId", "createdAt");
CREATE INDEX "sync_health_sourceId_idx" ON "sync_health"("sourceId");

-- CreateIndex
CREATE INDEX "conflicts_userId_resolvedAt_idx" ON "conflicts"("userId", "resolvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "booking_page_views_eventTypeId_date_key" ON "booking_page_views"("eventTypeId", "date");
CREATE INDEX "booking_page_views_eventTypeId_idx" ON "booking_page_views"("eventTypeId");

-- AddForeignKey
ALTER TABLE "booking_page_views" ADD CONSTRAINT "booking_page_views_eventTypeId_fkey" FOREIGN KEY ("eventTypeId") REFERENCES "event_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
