-- CreateTable
CREATE TABLE "ics_feeds" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'full',
    "daysInAdvance" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ics_feeds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_IcsFeedCalendars" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_IcsFeedCalendars_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "ics_feeds_token_key" ON "ics_feeds"("token");

-- CreateIndex
CREATE INDEX "ics_feeds_userId_idx" ON "ics_feeds"("userId");

-- CreateIndex
CREATE INDEX "_IcsFeedCalendars_B_index" ON "_IcsFeedCalendars"("B");

-- AddForeignKey
ALTER TABLE "ics_feeds" ADD CONSTRAINT "ics_feeds_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_IcsFeedCalendars" ADD CONSTRAINT "_IcsFeedCalendars_A_fkey" FOREIGN KEY ("A") REFERENCES "calendar_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_IcsFeedCalendars" ADD CONSTRAINT "_IcsFeedCalendars_B_fkey" FOREIGN KEY ("B") REFERENCES "ics_feeds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
