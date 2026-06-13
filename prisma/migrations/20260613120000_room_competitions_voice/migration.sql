CREATE TABLE "Competition" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "country" TEXT,
  "season" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Competition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Competition_slug_key" ON "Competition"("slug");

INSERT INTO "Competition" ("id", "slug", "name", "country", "season", "updatedAt") VALUES
  ('competition-world-cup-2026', 'mundial-2026', 'Copa Mundial de la FIFA 2026', 'Mundial', '2026', CURRENT_TIMESTAMP),
  ('competition-colombia', 'liga-colombiana', 'Liga Colombiana', 'Colombia', '2026', CURRENT_TIMESTAMP),
  ('competition-spain', 'liga-espanola', 'Liga Española', 'España', '2026-2027', CURRENT_TIMESTAMP),
  ('competition-champions', 'champions-league', 'Champions League', 'Europa', '2026-2027', CURRENT_TIMESTAMP);

ALTER TABLE "League"
  ADD COLUMN "competitionId" TEXT,
  ADD COLUMN "maxParticipants" INTEGER NOT NULL DEFAULT 20;

ALTER TABLE "Match"
  ADD COLUMN "competitionId" TEXT,
  ADD COLUMN "roomId" TEXT;

ALTER TABLE "LeagueMessage"
  ADD COLUMN "audioData" TEXT,
  ADD COLUMN "audioMime" TEXT,
  ADD COLUMN "audioDuration" INTEGER;

UPDATE "League" SET "competitionId" = 'competition-world-cup-2026' WHERE "competitionId" IS NULL;
UPDATE "Match" SET "competitionId" = 'competition-world-cup-2026' WHERE "competitionId" IS NULL;

CREATE INDEX "League_competitionId_idx" ON "League"("competitionId");
CREATE INDEX "Match_competitionId_idx" ON "Match"("competitionId");
CREATE INDEX "Match_roomId_idx" ON "Match"("roomId");

ALTER TABLE "League"
  ADD CONSTRAINT "League_competitionId_fkey"
  FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Match"
  ADD CONSTRAINT "Match_competitionId_fkey"
  FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Match"
  ADD CONSTRAINT "Match_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;
