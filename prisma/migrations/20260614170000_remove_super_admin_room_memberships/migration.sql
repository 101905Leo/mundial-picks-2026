WITH room_owner_replacements AS (
  SELECT
    "League"."id" AS "leagueId",
    replacement."userId" AS "replacementUserId"
  FROM "League"
  INNER JOIN "User" AS owner_user
    ON owner_user."id" = "League"."ownerId"
    AND owner_user."role" = 'ADMIN'
  INNER JOIN LATERAL (
    SELECT "LeagueMembership"."userId"
    FROM "LeagueMembership"
    INNER JOIN "User"
      ON "User"."id" = "LeagueMembership"."userId"
      AND "User"."role" <> 'ADMIN'
    WHERE "LeagueMembership"."leagueId" = "League"."id"
    ORDER BY
      CASE WHEN "LeagueMembership"."role" = 'ADMIN' THEN 0 ELSE 1 END,
      "LeagueMembership"."joinedAt" ASC
    LIMIT 1
  ) AS replacement ON true
)
UPDATE "League"
SET "ownerId" = room_owner_replacements."replacementUserId"
FROM room_owner_replacements
WHERE "League"."id" = room_owner_replacements."leagueId";

DELETE FROM "LeagueMembership"
WHERE "userId" IN (
  SELECT "id"
  FROM "User"
  WHERE "role" = 'ADMIN'
);
