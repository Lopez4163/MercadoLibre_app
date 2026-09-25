ALTER TABLE "BillingSubscription"
ADD COLUMN "degradedSince" TIMESTAMP(3);

CREATE INDEX "BillingSubscription_degradedSince_idx"
ON "BillingSubscription"("degradedSince");
