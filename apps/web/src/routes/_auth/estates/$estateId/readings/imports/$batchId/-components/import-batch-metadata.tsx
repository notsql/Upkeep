import { env } from "@proj/env/web";
import { Button } from "@proj/ui/components/button";
import type { MouseEvent } from "react";
import { DetailList } from "@/components/page/detail-list";
import { PageSection } from "@/components/page/section-card";
import type { ReadingImportBatch } from "@/lib/reading-imports";

export function ImportBatchMetadata({
  batch,
  canRevert,
  downloading,
  estateId,
  batchId,
  onDownload,
  onShowRevert,
}: {
  batch: ReadingImportBatch;
  canRevert: boolean;
  downloading: boolean;
  estateId: string;
  batchId: string;
  onDownload: (event: MouseEvent<HTMLAnchorElement>) => void;
  onShowRevert: () => void;
}) {
  return (
    <PageSection title="Batch metadata">
      <DetailList>
        <div>
          <dt>Source</dt>
          <dd>{batch.sourceLabel}</dd>
        </div>
        <div>
          <dt>Batch</dt>
          <dd>{batch.id}</dd>
        </div>
        <div>
          <dt>Uploader</dt>
          <dd>{batch.uploaderName || batch.uploaderUserId}</dd>
        </div>
        <div>
          <dt>Counts</dt>
          <dd>
            {batch.totalRows} total · {batch.importedRows} imported ·{" "}
            {batch.duplicateRows} already imported · {batch.invalidRows} with
            problems · {batch.warningRows} with warnings
          </dd>
        </div>
      </DetailList>
      {batch.status === "REVERTED" ? (
        <p>
          {batch.removedCount} readings removed · {batch.rollbackReason}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button
          disabled={downloading}
          render={
            <a
              href={`${env.VITE_API_URL}/estates/${estateId}/readings/imports/${batchId}/report`}
              onClick={onDownload}
            />
          }
          variant="outline"
        >
          Download report
        </Button>
        {canRevert && batch.status !== "REVERTED" ? (
          <Button onClick={onShowRevert} variant="destructive">
            Revert batch
          </Button>
        ) : null}
      </div>
      {canRevert ? null : (
        <p className="text-muted-foreground text-sm">
          Rollback is unavailable while the estate is inactive or access is
          restricted.
        </p>
      )}
    </PageSection>
  );
}
