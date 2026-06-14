ALTER TABLE "Prediction"
  ADD COLUMN "leagueId" TEXT,
  ADD COLUMN "roomKey" TEXT NOT NULL DEFAULT 'GLOBAL';

UPDATE "Prediction" AS prediction
SET
  "leagueId" = match."roomId",
  "roomKey" = match."roomId"
FROM "Match" AS match
WHERE prediction."matchId" = match."id"
  AND match."roomId" IS NOT NULL;

DROP INDEX IF EXISTS "Prediction_userId_matchId_key";

CREATE UNIQUE INDEX "Prediction_userId_matchId_roomKey_key" ON "Prediction"("userId", "matchId", "roomKey");
CREATE INDEX "Prediction_leagueId_idx" ON "Prediction"("leagueId");

ALTER TABLE "Prediction"
  ADD CONSTRAINT "Prediction_leagueId_fkey"
  FOREIGN KEY ("leagueId") REFERENCES "League"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
