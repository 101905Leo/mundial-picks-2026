-- Preserve access for rooms that existed before room-plan billing was introduced.
UPDATE "League"
SET
  "paymentStatus" = 'MANUAL',
  "paidAt" = COALESCE("paidAt", "createdAt")
WHERE "paymentStatus" = 'PENDING';
