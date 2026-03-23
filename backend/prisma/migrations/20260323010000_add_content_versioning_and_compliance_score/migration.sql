-- AlterTable: add complianceScore and version columns to drafts
ALTER TABLE "drafts" ADD COLUMN IF NOT EXISTS "complianceScore" DOUBLE PRECISION;
ALTER TABLE "drafts" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable: content_versions
CREATE TABLE IF NOT EXISTS "content_versions" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "linkedinContent" TEXT,
    "facebookContent" TEXT,
    "emailContent" TEXT,
    "adCopyContent" TEXT,
    "status" "ContentStatus" NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changeNote" TEXT,

    CONSTRAINT "content_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "content_versions_draftId_versionNumber_key" ON "content_versions"("draftId", "versionNumber");
CREATE INDEX IF NOT EXISTS "content_versions_draftId_idx" ON "content_versions"("draftId");

-- AddForeignKey
ALTER TABLE "content_versions" ADD CONSTRAINT "content_versions_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "content_versions" ADD CONSTRAINT "content_versions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
