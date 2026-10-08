-- CreateTable
CREATE TABLE "StorageMonthClosure" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedById" TEXT,

    CONSTRAINT "StorageMonthClosure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StorageMonthClosure_month_key" ON "StorageMonthClosure"("month");

