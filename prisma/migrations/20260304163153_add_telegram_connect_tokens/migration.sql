-- CreateTable
CREATE TABLE "TelegramConnectToken" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramConnectToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramConnectToken_code_key" ON "TelegramConnectToken"("code");

-- CreateIndex
CREATE INDEX "TelegramConnectToken_userId_usedAt_expiresAt_idx" ON "TelegramConnectToken"("userId", "usedAt", "expiresAt");

-- AddForeignKey
ALTER TABLE "TelegramConnectToken" ADD CONSTRAINT "TelegramConnectToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
