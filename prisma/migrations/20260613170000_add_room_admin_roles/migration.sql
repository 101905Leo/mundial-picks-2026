CREATE TYPE "LeagueRole" AS ENUM ('MEMBER', 'ADMIN');

ALTER TABLE "LeagueMembership"
  ADD COLUMN "role" "LeagueRole" NOT NULL DEFAULT 'MEMBER';

UPDATE "LeagueMembership" AS membership
SET "role" = 'ADMIN'
FROM "League" AS league
WHERE membership."leagueId" = league."id"
  AND membership."userId" = league."ownerId";
