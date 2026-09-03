-- CreateEnum
CREATE TYPE "DataExportStatus" AS ENUM ('PENDING', 'READY', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "DataExportRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "DataExportStatus" NOT NULL DEFAULT 'PENDING',
    "storageKey" TEXT,
    "sizeBytes" INTEGER,
    "error" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readyAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "DataExportRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DataExportRequest_userId_requestedAt_idx" ON "DataExportRequest"("userId", "requestedAt");

-- CreateIndex
CREATE INDEX "DataExportRequest_status_requestedAt_idx" ON "DataExportRequest"("status", "requestedAt");

-- AddForeignKey
ALTER TABLE "DataExportRequest" ADD CONSTRAINT "DataExportRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
