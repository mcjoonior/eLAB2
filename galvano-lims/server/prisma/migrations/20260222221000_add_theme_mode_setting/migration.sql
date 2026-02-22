CREATE TYPE "ThemeMode" AS ENUM ('LIGHT', 'DARK');

ALTER TABLE "company_settings"
ADD COLUMN "themeMode" "ThemeMode" NOT NULL DEFAULT 'LIGHT';
