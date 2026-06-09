ALTER TABLE "User" ADD COLUMN "entryPaidAt" TIMESTAMP(3);

UPDATE "User" SET "entryPaidAt" = NOW() WHERE "creditBalance" > 0;

CREATE TABLE "EntryPayment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "transactionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "amountInCents" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EntryPayment_pkey" PRIMARY KEY ("id")
);

INSERT INTO "EntryPayment" ("id", "userId", "reference", "transactionId", "status", "amountInCents", "paidAt", "createdAt", "updatedAt")
SELECT "id", "userId", "reference", "transactionId", "status", "amountInCents", "creditedAt", "createdAt", "updatedAt"
FROM "CreditPurchase";

UPDATE "User" u
SET "entryPaidAt" = ep."paidAt"
FROM "EntryPayment" ep
WHERE ep."userId" = u."id" AND ep."paidAt" IS NOT NULL AND u."entryPaidAt" IS NULL;

CREATE UNIQUE INDEX "EntryPayment_reference_key" ON "EntryPayment"("reference");
CREATE INDEX "EntryPayment_userId_idx" ON "EntryPayment"("userId");
CREATE INDEX "EntryPayment_transactionId_idx" ON "EntryPayment"("transactionId");

ALTER TABLE "EntryPayment" ADD CONSTRAINT "EntryPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP TABLE "CreditPurchase";
ALTER TABLE "User" DROP COLUMN "creditBalance";
