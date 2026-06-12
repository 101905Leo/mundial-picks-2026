CREATE TABLE "LeagueMessage" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeagueMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LeagueMessage_leagueId_createdAt_idx" ON "LeagueMessage"("leagueId", "createdAt");
CREATE INDEX "LeagueMessage_userId_idx" ON "LeagueMessage"("userId");

ALTER TABLE "LeagueMessage"
ADD CONSTRAINT "LeagueMessage_leagueId_fkey"
FOREIGN KEY ("leagueId") REFERENCES "League"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeagueMessage"
ADD CONSTRAINT "LeagueMessage_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
