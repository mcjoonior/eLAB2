-- Add dashboard variant setting for admin-selectable dashboard layout
CREATE TYPE "DashboardVariant" AS ENUM ('CLEAN', 'MODERN');

ALTER TABLE "company_settings"
ADD COLUMN "dashboardVariant" "DashboardVariant" NOT NULL DEFAULT 'CLEAN';
