import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Badge } from "@proj/ui/components/badge";
import { FileSpreadsheet } from "lucide-react";
import { DetailPageHeader } from "@/components/page/detail-page-header";
import { PageLayout } from "@/components/page/page-layout";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { ImportBatchMetadata } from "@/routes/_auth/estates/$estateId/readings/imports/$batchId/-components/import-batch-metadata";
import { ImportBatchResults } from "@/routes/_auth/estates/$estateId/readings/imports/$batchId/-components/import-batch-results";
import { ImportBatchRollback } from "@/routes/_auth/estates/$estateId/readings/imports/$batchId/-components/import-batch-rollback";
import { useReadingImportBatchState } from "@/routes/_auth/estates/$estateId/readings/imports/$batchId/-components/use-reading-import-batch-state";

export function ReadingImportBatchPage({
  estateId,
  batchId,
}: {
  estateId: string;
  batchId: string;
}) {
  const state = useReadingImportBatchState({ estateId, batchId });
  const { access, allowed, batch, detail, error, open, retryDetail } = state;
  if (access.data && !allowed) {
    return (
      <Alert>
        <AlertDescription>
          Import reports are unavailable for this estate.
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <PageLayout className="min-w-0 space-y-6 [overflow-wrap:anywhere]">
      <DetailPageHeader
        breadcrumbs={[
          {
            label: "Readings",
            to: "/estates/$estateId/readings",
            params: { estateId },
          },
          {
            label: "Import CSV",
            to: "/estates/$estateId/readings/imports",
            params: { estateId },
          },
          { label: "Import batch" },
        ]}
        icon={FileSpreadsheet}
        meta={
          batch
            ? `${batch.originalFilename} · ${new Date(batch.createdAt).toLocaleString()}`
            : undefined
        }
        status={
          batch ? <Badge variant="outline">{batch.status}</Badge> : undefined
        }
        title="Import batch"
      />
      {detail.isPending && allowed ? (
        <LoadingState label="Loading import batch…" rows={3} />
      ) : null}
      {detail.error ? (
        <ErrorState message={detail.error.message} onRetry={retryDetail} />
      ) : null}
      {batch ? (
        <>
          <ImportBatchMetadata
            batch={batch}
            batchId={batchId}
            canRevert={Boolean(state.permission?.canRevertReadingImports)}
            downloading={state.downloading}
            estateId={estateId}
            onDownload={state.handleDownload}
            onShowRevert={state.showRevert}
          />
          <ImportBatchResults
            onClearOutcome={state.clearOutcome}
            onNext={state.nextPage}
            onOutcomeChange={state.changeOutcome}
            onPrevious={state.previousPage}
            onRetry={state.retryRows}
            outcome={state.outcome}
            page={state.page}
            rows={state.rows}
          />
          <ImportBatchRollback
            batch={batch}
            error={error}
            onCancel={state.hideRevert}
            onConfirm={state.revert}
            onReasonChange={state.changeReason}
            open={open}
            pending={state.rollback.isPending}
            reason={state.reason}
          />
        </>
      ) : null}
      {error && !open ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </PageLayout>
  );
}
