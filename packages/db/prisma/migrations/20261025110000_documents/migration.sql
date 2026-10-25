-- CreateTable
CREATE TABLE "Document" (
    "id" UUID NOT NULL,
    "estateId" UUID NOT NULL,
    "documentType" VARCHAR(20) NOT NULL,
    "originalFilename" VARCHAR(255) NOT NULL,
    "contentType" VARCHAR(50) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" VARCHAR(500) NOT NULL,
    "uploadedByUserId" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(6),
    "deletedByUserId" VARCHAR(255),
    "storageDeletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Document_storageKey_key" ON "Document"("storageKey");

-- CreateIndex
CREATE INDEX "Document_estateId_createdAt_id_idx" ON "Document"("estateId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Document_deletedAt_storageDeletedAt_idx" ON "Document"("deletedAt", "storageDeletedAt");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_estateId_fkey" FOREIGN KEY ("estateId") REFERENCES "Estate"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "Document"
  ADD CONSTRAINT "Document_type_check" CHECK ("documentType" IN ('INVOICE', 'SERVICE_REPORT')),
  ADD CONSTRAINT "Document_size_check" CHECK ("sizeBytes" BETWEEN 1 AND 5000000),
  ADD CONSTRAINT "Document_filename_check" CHECK (length(trim("originalFilename")) > 0),
  ADD CONSTRAINT "Document_content_type_check" CHECK ("contentType" IN ('application/pdf', 'image/jpeg', 'image/png')),
  ADD CONSTRAINT "Document_deletion_check" CHECK (("deletedAt" IS NULL) = ("deletedByUserId" IS NULL)),
  ADD CONSTRAINT "Document_storage_deletion_check" CHECK ("storageDeletedAt" IS NULL OR "deletedAt" IS NOT NULL);

INSERT INTO "Permission" ("code", "label", "description") VALUES
 ('VIEW_DOCUMENTS', 'View invoices and service reports', 'List, search and download estate invoices and service reports.'),
 ('EDIT_DOCUMENTS', 'Edit invoices and service reports', 'Upload documents and delete own uploads; Managers may delete any document in their estate. Requires VIEW_DOCUMENTS.');
