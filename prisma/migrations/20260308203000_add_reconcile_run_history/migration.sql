-- CreateTable
CREATE TABLE "ReconcileRun" (
  "id" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "triggerSource" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "durationMs" INTEGER,
  "usersProcessed" INTEGER,
  "usersFailed" INTEGER,
  "itemsChecked" INTEGER,
  "itemsUpdated" INTEGER,
  "soldOutAlertsSent" INTEGER,
  "lowStockAlertsSent" INTEGER,
  "errorMessage" TEXT,

  CONSTRAINT "ReconcileRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReconcileRun_startedAt_idx" ON "ReconcileRun"("startedAt");

-- CreateIndex
CREATE INDEX "ReconcileRun_status_startedAt_idx" ON "ReconcileRun"("status", "startedAt");
