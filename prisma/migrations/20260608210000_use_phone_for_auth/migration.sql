ALTER TABLE "User" RENAME COLUMN "email" TO "phone";

ALTER INDEX "User_email_key" RENAME TO "User_phone_key";
