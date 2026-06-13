ALTER TABLE "League"
  ADD COLUMN "paymentReference" TEXT,
  ADD COLUMN "paymentStatus" TEXT NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN "paymentAmountInCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "paidAt" TIMESTAMP(3);

UPDATE "League"
SET "paidAt" = COALESCE("paidAt", NOW()),
    "paymentStatus" = 'APPROVED'
WHERE "paidAt" IS NULL;

ALTER TABLE "League" ALTER COLUMN "paymentStatus" SET DEFAULT 'PENDING';

CREATE UNIQUE INDEX "League_paymentReference_key" ON "League"("paymentReference");
