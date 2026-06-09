ALTER TABLE "User" DROP COLUMN IF EXISTS "hasPaidAccess";
ALTER TABLE "User" DROP COLUMN IF EXISTS "paidAt";
ALTER TABLE "User" ADD COLUMN "creditBalance" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "CreditPurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "transactionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "amountInCents" INTEGER NOT NULL,
    "credits" INTEGER NOT NULL,
    "creditedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditPurchase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CreditPurchase_reference_key" ON "CreditPurchase"("reference");
CREATE INDEX "CreditPurchase_userId_idx" ON "CreditPurchase"("userId");
CREATE INDEX "CreditPurchase_transactionId_idx" ON "CreditPurchase"("transactionId");

ALTER TABLE "CreditPurchase" ADD CONSTRAINT "CreditPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
