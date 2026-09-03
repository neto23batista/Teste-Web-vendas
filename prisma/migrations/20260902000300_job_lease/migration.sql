-- CreateTable
CREATE TABLE "JobLease" (
    "name" TEXT NOT NULL,
    "holder" TEXT NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobLease_pkey" PRIMARY KEY ("name")
);

-- CreateIndex
CREATE INDEX "JobLease_expiresAt_idx" ON "JobLease"("expiresAt");
