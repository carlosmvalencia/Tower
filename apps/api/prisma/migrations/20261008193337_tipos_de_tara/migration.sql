-- CreateEnum
CREATE TYPE "TareKind" AS ENUM ('CANASTILLA', 'ESTIBA', 'OTRO');

-- CreateTable
CREATE TABLE "TareType" (
    "id" TEXT NOT NULL,
    "kind" "TareKind" NOT NULL,
    "name" TEXT NOT NULL,
    "weightKg" DECIMAL(8,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TareType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptLineTare" (
    "id" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "tareTypeId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,

    CONSTRAINT "ReceiptLineTare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TareType_kind_name_key" ON "TareType"("kind", "name");

-- CreateIndex
CREATE INDEX "ReceiptLineTare_lineId_idx" ON "ReceiptLineTare"("lineId");

-- AddForeignKey
ALTER TABLE "ReceiptLineTare" ADD CONSTRAINT "ReceiptLineTare_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "ReceiptLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptLineTare" ADD CONSTRAINT "ReceiptLineTare_tareTypeId_fkey" FOREIGN KEY ("tareTypeId") REFERENCES "TareType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Tipos de tara iniciales (desde las taras estándar que se venían usando)
INSERT INTO "TareType" ("id", "kind", "name", "weightKg", "updatedAt")
VALUES
  ('taretype_canastilla_std', 'CANASTILLA', 'Canastilla estándar', 2, NOW()),
  ('taretype_estiba_std', 'ESTIBA', 'Estiba estándar', 25, NOW());
