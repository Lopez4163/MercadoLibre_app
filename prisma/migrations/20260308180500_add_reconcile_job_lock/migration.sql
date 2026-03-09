-- CreateTable
CREATE TABLE "ReconcileJobLock" (
  "name" TEXT NOT NULL,
  "ownerId" TEXT,
  "lockedAt" TIMESTAMP(3),
  "lockExpiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ReconcileJobLock_pkey" PRIMARY KEY ("name")
);
