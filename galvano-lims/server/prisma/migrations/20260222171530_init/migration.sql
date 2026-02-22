-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'LABORANT', 'VIEWER');

-- CreateEnum
CREATE TYPE "ProcessType" AS ENUM ('ZINC', 'NICKEL', 'CHROME', 'COPPER', 'TIN', 'GOLD', 'SILVER', 'ANODIZING', 'PASSIVATION', 'OTHER');

-- CreateEnum
CREATE TYPE "SampleType" AS ENUM ('BATH', 'RINSE', 'WASTEWATER', 'RAW_MATERIAL', 'OTHER');

-- CreateEnum
CREATE TYPE "SampleStatus" AS ENUM ('REGISTERED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "Deviation" AS ENUM ('CRITICAL_LOW', 'BELOW_MIN', 'WITHIN_RANGE', 'ABOVE_MAX', 'CRITICAL_HIGH');

-- CreateEnum
CREATE TYPE "RecommendationType" AS ENUM ('INCREASE', 'DECREASE', 'MAINTAIN', 'URGENT_ACTION');

-- CreateEnum
CREATE TYPE "AnalysisType" AS ENUM ('CHEMICAL', 'CORROSION_TEST', 'SURFACE_ANALYSIS');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ImportType" AS ENUM ('FULL', 'CLIENTS_ONLY', 'ANALYSES_ONLY', 'PROCESSES_ONLY', 'SAMPLES_ONLY');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('UPLOADED', 'VALIDATING', 'VALIDATION_FAILED', 'IMPORTING', 'COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'OUT_OF_SERVICE', 'RETIRED');

-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('CALIBRATION', 'INSPECTION', 'SERVICE');

-- CreateEnum
CREATE TYPE "MaintenanceResult" AS ENUM ('PASSED', 'FAILED', 'CONDITIONAL');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'COMPLETED', 'INVOICED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'LABORANT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "nip" TEXT,
    "address" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Polska',
    "contactPerson" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "legacyCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "processType" TEXT NOT NULL,
    "clientId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "legacyCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "processes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "process_type_definitions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "process_type_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "process_parameters" (
    "id" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "parameterName" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "minValue" DECIMAL(12,4),
    "maxValue" DECIMAL(12,4),
    "optimalValue" DECIMAL(12,4),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "process_parameters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "samples" (
    "id" TEXT NOT NULL,
    "sampleCode" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "collectedBy" TEXT,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sampleType" "SampleType" NOT NULL DEFAULT 'BATH',
    "description" TEXT,
    "status" "SampleStatus" NOT NULL DEFAULT 'REGISTERED',
    "orderId" TEXT,
    "legacyCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "samples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analyses" (
    "id" TEXT NOT NULL,
    "analysisCode" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "priceListId" TEXT,
    "performedBy" TEXT NOT NULL,
    "analysisDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "analysisType" "AnalysisType" NOT NULL DEFAULT 'CHEMICAL',
    "notes" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "legacyCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_attachments" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analysis_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_results" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "parameterName" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "value" DECIMAL(12,4) NOT NULL,
    "measurementUncertainty" DECIMAL(12,4),
    "minReference" DECIMAL(12,4),
    "maxReference" DECIMAL(12,4),
    "optimalReference" DECIMAL(12,4),
    "deviation" "Deviation" NOT NULL DEFAULT 'WITHIN_RANGE',
    "deviationPercent" DECIMAL(8,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analysis_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendations" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "parameterName" TEXT NOT NULL,
    "currentValue" DECIMAL(12,4),
    "targetValue" DECIMAL(12,4),
    "recommendationType" "RecommendationType" NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "reportCode" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "generatedBy" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pdfPath" TEXT,
    "sentToClient" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),
    "sentToEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_settings" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL DEFAULT 'Laboratorium Galwaniczne',
    "appSubtitle" TEXT DEFAULT 'LIMS',
    "logoUrl" TEXT,
    "address" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "nip" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "smtpHost" TEXT,
    "smtpPort" INTEGER DEFAULT 587,
    "smtpUser" TEXT,
    "smtpPassword" TEXT,
    "smtpFrom" TEXT,
    "reportHeaderText" TEXT DEFAULT 'Raport z analizy laboratoryjnej',
    "reportFooterText" TEXT DEFAULT 'Dokument wygenerowany automatycznie przez system LIMS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" TEXT NOT NULL,
    "importCode" TEXT NOT NULL,
    "importedBy" TEXT NOT NULL,
    "sourceSystem" TEXT,
    "importType" "ImportType" NOT NULL DEFAULT 'FULL',
    "status" "ImportStatus" NOT NULL DEFAULT 'UPLOADED',
    "fileName" TEXT,
    "fileSize" INTEGER,
    "totalRecords" INTEGER NOT NULL DEFAULT 0,
    "importedRecords" INTEGER NOT NULL DEFAULT 0,
    "skippedRecords" INTEGER NOT NULL DEFAULT 0,
    "errorRecords" INTEGER NOT NULL DEFAULT 0,
    "validationErrors" JSONB,
    "mappingConfig" JSONB,
    "notes" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "mappingConfig" JSONB NOT NULL,
    "sourceSystem" TEXT,
    "createdBy" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_price_list" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "analysisType" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT,
    "priceNet" DECIMAL(12,2) NOT NULL,
    "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 23,
    "currency" TEXT NOT NULL DEFAULT 'PLN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analysis_price_list_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "orderCode" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'NEW',
    "currency" TEXT NOT NULL DEFAULT 'PLN',
    "notes" TEXT,
    "manualAdjustmentNet" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "manualAdjustmentVatRate" DECIMAL(5,2) NOT NULL DEFAULT 23,
    "totalNet" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalGross" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "sampleId" TEXT,
    "analysisId" TEXT,
    "priceListId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "unitPriceNet" DECIMAL(12,2) NOT NULL,
    "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 23,
    "lineTotalNet" DECIMAL(12,2) NOT NULL,
    "lineTotalGross" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_devices" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL,
    "manufacturer" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "location" TEXT,
    "status" "DeviceStatus" NOT NULL DEFAULT 'ACTIVE',
    "requiresCalibration" BOOLEAN NOT NULL DEFAULT true,
    "requiresInspection" BOOLEAN NOT NULL DEFAULT false,
    "calibrationIntervalDays" INTEGER,
    "inspectionIntervalDays" INTEGER,
    "lastCalibrationAt" TIMESTAMP(3),
    "nextCalibrationAt" TIMESTAMP(3),
    "lastInspectionAt" TIMESTAMP(3),
    "nextInspectionAt" TIMESTAMP(3),
    "responsibleUserId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_maintenance_logs" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "maintenanceType" "MaintenanceType" NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL,
    "result" "MaintenanceResult" NOT NULL DEFAULT 'PASSED',
    "certificateNumber" TEXT,
    "certificatePath" TEXT,
    "notes" TEXT,
    "performedBy" TEXT,
    "nextDueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_maintenance_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'info',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "clients_nip_key" ON "clients"("nip");

-- CreateIndex
CREATE UNIQUE INDEX "process_type_definitions_code_key" ON "process_type_definitions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "process_type_definitions_name_key" ON "process_type_definitions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "samples_sampleCode_key" ON "samples"("sampleCode");

-- CreateIndex
CREATE UNIQUE INDEX "analyses_analysisCode_key" ON "analyses"("analysisCode");

-- CreateIndex
CREATE UNIQUE INDEX "reports_reportCode_key" ON "reports"("reportCode");

-- CreateIndex
CREATE UNIQUE INDEX "import_jobs_importCode_key" ON "import_jobs"("importCode");

-- CreateIndex
CREATE INDEX "analysis_price_list_analysisType_effectiveFrom_isActive_idx" ON "analysis_price_list"("analysisType", "effectiveFrom", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "analysis_price_list_code_effectiveFrom_key" ON "analysis_price_list"("code", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderCode_key" ON "orders"("orderCode");

-- CreateIndex
CREATE INDEX "orders_clientId_status_idx" ON "orders"("clientId", "status");

-- CreateIndex
CREATE INDEX "order_items_orderId_idx" ON "order_items"("orderId");

-- CreateIndex
CREATE INDEX "order_items_sampleId_idx" ON "order_items"("sampleId");

-- CreateIndex
CREATE INDEX "order_items_analysisId_idx" ON "order_items"("analysisId");

-- CreateIndex
CREATE UNIQUE INDEX "lab_devices_code_key" ON "lab_devices"("code");

-- CreateIndex
CREATE UNIQUE INDEX "lab_devices_serialNumber_key" ON "lab_devices"("serialNumber");

-- CreateIndex
CREATE INDEX "lab_devices_status_idx" ON "lab_devices"("status");

-- CreateIndex
CREATE INDEX "lab_devices_nextCalibrationAt_idx" ON "lab_devices"("nextCalibrationAt");

-- CreateIndex
CREATE INDEX "lab_devices_nextInspectionAt_idx" ON "lab_devices"("nextInspectionAt");

-- CreateIndex
CREATE INDEX "device_maintenance_logs_deviceId_performedAt_idx" ON "device_maintenance_logs"("deviceId", "performedAt");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- AddForeignKey
ALTER TABLE "processes" ADD CONSTRAINT "processes_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_parameters" ADD CONSTRAINT "process_parameters_processId_fkey" FOREIGN KEY ("processId") REFERENCES "processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "samples" ADD CONSTRAINT "samples_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "samples" ADD CONSTRAINT "samples_processId_fkey" FOREIGN KEY ("processId") REFERENCES "processes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "samples" ADD CONSTRAINT "samples_collectedBy_fkey" FOREIGN KEY ("collectedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "samples" ADD CONSTRAINT "samples_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "samples"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "analysis_price_list"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_attachments" ADD CONSTRAINT "analysis_attachments_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_results" ADD CONSTRAINT "analysis_results_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "analyses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_generatedBy_fkey" FOREIGN KEY ("generatedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_importedBy_fkey" FOREIGN KEY ("importedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "samples"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "analyses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "analysis_price_list"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_devices" ADD CONSTRAINT "lab_devices_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_maintenance_logs" ADD CONSTRAINT "device_maintenance_logs_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "lab_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_maintenance_logs" ADD CONSTRAINT "device_maintenance_logs_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
