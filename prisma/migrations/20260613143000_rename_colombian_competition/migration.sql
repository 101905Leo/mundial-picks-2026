UPDATE "Competition"
SET
  "name" = 'Fútbol Colombiano',
  "country" = 'Colombia',
  "season" = '2026',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'liga-colombiana';
