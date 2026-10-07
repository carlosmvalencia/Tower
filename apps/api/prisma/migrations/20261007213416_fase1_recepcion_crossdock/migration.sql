-- CreateEnum
CREATE TYPE "CustomerServiceType" AS ENUM ('INVENTORY', 'CROSS_DOCK', 'BOTH');

-- CreateEnum
CREATE TYPE "MeasureType" AS ENUM ('KG', 'UND');

-- CreateEnum
CREATE TYPE "ReceiptStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PalletStatus" AS ENUM ('IN_STORAGE', 'DISPATCHED');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('IN', 'OUT', 'ADJUST_IN', 'ADJUST_OUT');

-- CreateEnum
CREATE TYPE "CrossDockStatus" AS ENUM ('OPEN', 'CLOSED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "addressLine" TEXT,
ADD COLUMN     "serviceType" "CustomerServiceType" NOT NULL DEFAULT 'INVENTORY';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "measure" "MeasureType" NOT NULL DEFAULT 'UND';

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Lot" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "ReceiptStatus" NOT NULL DEFAULT 'DRAFT',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pallet" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "environment" "Environment" NOT NULL,
    "status" "PalletStatus" NOT NULL DEFAULT 'IN_STORAGE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptLine" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "palletId" TEXT,
    "productId" TEXT NOT NULL,
    "lotCode" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "lotId" TEXT,
    "grossKg" DECIMAL(10,2),
    "canastillas" INTEGER NOT NULL DEFAULT 0,
    "estibas" INTEGER NOT NULL DEFAULT 0,
    "tareKg" DECIMAL(10,2),
    "netKg" DECIMAL(10,2),
    "units" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceiptLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "productId" TEXT NOT NULL,
    "lotId" TEXT,
    "qty" DECIMAL(12,2) NOT NULL,
    "reference" TEXT,
    "receiptLineId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrossDockReceipt" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "CrossDockStatus" NOT NULL DEFAULT 'OPEN',
    "arrivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "boxesIn" INTEGER NOT NULL,
    "grossKg" DECIMAL(10,2),
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrossDockReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrossDockDispatch" (
    "id" TEXT NOT NULL,
    "crossDockReceiptId" TEXT NOT NULL,
    "dispatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "boxesOut" INTEGER NOT NULL,
    "destination" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrossDockDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "receiptId" TEXT,
    "crossDockReceiptId" TEXT,
    "crossDockDispatchId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lot_expiryDate_idx" ON "Lot"("expiryDate");

-- CreateIndex
CREATE UNIQUE INDEX "Lot_productId_code_key" ON "Lot"("productId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_code_key" ON "Receipt"("code");

-- CreateIndex
CREATE INDEX "Receipt_customerId_idx" ON "Receipt"("customerId");

-- CreateIndex
CREATE INDEX "Receipt_status_idx" ON "Receipt"("status");

-- CreateIndex
CREATE INDEX "Receipt_receivedAt_idx" ON "Receipt"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Pallet_code_key" ON "Pallet"("code");

-- CreateIndex
CREATE INDEX "Pallet_receiptId_idx" ON "Pallet"("receiptId");

-- CreateIndex
CREATE INDEX "ReceiptLine_receiptId_idx" ON "ReceiptLine"("receiptId");

-- CreateIndex
CREATE INDEX "ReceiptLine_palletId_idx" ON "ReceiptLine"("palletId");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_receiptLineId_key" ON "StockMovement"("receiptLineId");

-- CreateIndex
CREATE INDEX "StockMovement_productId_idx" ON "StockMovement"("productId");

-- CreateIndex
CREATE INDEX "StockMovement_lotId_idx" ON "StockMovement"("lotId");

-- CreateIndex
CREATE INDEX "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CrossDockReceipt_code_key" ON "CrossDockReceipt"("code");

-- CreateIndex
CREATE INDEX "CrossDockReceipt_customerId_idx" ON "CrossDockReceipt"("customerId");

-- CreateIndex
CREATE INDEX "CrossDockReceipt_status_idx" ON "CrossDockReceipt"("status");

-- CreateIndex
CREATE INDEX "CrossDockDispatch_crossDockReceiptId_idx" ON "CrossDockDispatch"("crossDockReceiptId");

-- CreateIndex
CREATE INDEX "Photo_receiptId_idx" ON "Photo"("receiptId");

-- CreateIndex
CREATE INDEX "Photo_crossDockReceiptId_idx" ON "Photo"("crossDockReceiptId");

-- CreateIndex
CREATE INDEX "Photo_crossDockDispatchId_idx" ON "Photo"("crossDockDispatchId");

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pallet" ADD CONSTRAINT "Pallet_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptLine" ADD CONSTRAINT "ReceiptLine_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptLine" ADD CONSTRAINT "ReceiptLine_palletId_fkey" FOREIGN KEY ("palletId") REFERENCES "Pallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptLine" ADD CONSTRAINT "ReceiptLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptLine" ADD CONSTRAINT "ReceiptLine_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_receiptLineId_fkey" FOREIGN KEY ("receiptLineId") REFERENCES "ReceiptLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrossDockReceipt" ADD CONSTRAINT "CrossDockReceipt_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrossDockDispatch" ADD CONSTRAINT "CrossDockDispatch_crossDockReceiptId_fkey" FOREIGN KEY ("crossDockReceiptId") REFERENCES "CrossDockReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_crossDockReceiptId_fkey" FOREIGN KEY ("crossDockReceiptId") REFERENCES "CrossDockReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_crossDockDispatchId_fkey" FOREIGN KEY ("crossDockDispatchId") REFERENCES "CrossDockDispatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
