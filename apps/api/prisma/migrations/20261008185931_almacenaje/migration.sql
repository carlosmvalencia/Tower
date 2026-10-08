-- CreateEnum
CREATE TYPE "StorageChargeUnit" AS ENUM ('POSITION_DAY', 'KG_DAY');

-- CreateEnum
CREATE TYPE "StorageExtraKind" AS ENUM ('CARGUE_DESCARGUE', 'NIVELACION', 'OTRO');

-- CreateTable
CREATE TABLE "StorageRate" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "environment" "Environment" NOT NULL,
    "unit" "StorageChargeUnit" NOT NULL,
    "ratePerDay" DECIMAL(12,2) NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StorageRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorageExtraRate" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "kind" "StorageExtraKind" NOT NULL,
    "name" TEXT,
    "ratePerKg" DECIMAL(12,2) NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StorageExtraRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorageDay" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "customerId" TEXT NOT NULL,
    "environment" "Environment" NOT NULL,
    "posIn" INTEGER NOT NULL DEFAULT 0,
    "posOut" INTEGER NOT NULL DEFAULT 0,
    "kgIn" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "kgOut" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "kgHandledOverride" DECIMAL(12,2),
    "kgLeveled" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "invoiceRef" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorageDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StorageRate_customerId_environment_validFrom_idx" ON "StorageRate"("customerId", "environment", "validFrom");

-- CreateIndex
CREATE INDEX "StorageExtraRate_customerId_kind_validFrom_idx" ON "StorageExtraRate"("customerId", "kind", "validFrom");

-- CreateIndex
CREATE INDEX "StorageDay_customerId_date_idx" ON "StorageDay"("customerId", "date");

-- CreateIndex
CREATE INDEX "StorageDay_date_idx" ON "StorageDay"("date");

-- CreateIndex
CREATE UNIQUE INDEX "StorageDay_date_customerId_environment_key" ON "StorageDay"("date", "customerId", "environment");

-- AddForeignKey
ALTER TABLE "StorageRate" ADD CONSTRAINT "StorageRate_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorageExtraRate" ADD CONSTRAINT "StorageExtraRate_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorageDay" ADD CONSTRAINT "StorageDay_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

