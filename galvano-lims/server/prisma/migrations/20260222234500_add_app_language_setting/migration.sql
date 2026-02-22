-- CreateEnum
CREATE TYPE "AppLanguage" AS ENUM ('PL', 'EN');

-- AlterTable
ALTER TABLE "company_settings"
ADD COLUMN "appLanguage" "AppLanguage" NOT NULL DEFAULT 'PL';
