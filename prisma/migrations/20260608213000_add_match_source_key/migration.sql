ALTER TABLE "Match" ADD COLUMN "sourceKey" TEXT;

CREATE UNIQUE INDEX "Match_sourceKey_key" ON "Match"("sourceKey");
