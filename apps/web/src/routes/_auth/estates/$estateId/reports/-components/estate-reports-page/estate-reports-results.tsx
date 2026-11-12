import type { components } from "@proj/api/schema";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { LoadMore } from "@/components/table/load-more";
import { Pagination } from "@/components/table/pagination";
import { ReportRequestError } from "@/lib/estate-reports";
import type { PagedList } from "@/lib/infinite-list";
import { useMobile } from "@/lib/use-mobile";
import { EstateReportsItems } from "@/routes/_auth/estates/$estateId/reports/-components/estate-reports-page/estate-reports-items";
import { EstateReportsTable } from "@/routes/_auth/estates/$estateId/reports/-components/estate-reports-page/estate-reports-table";
import { ReportsEmpty } from "@/routes/_auth/estates/$estateId/reports/-components/estate-reports-page/reports-empty";

export function EstateReportsResults({
  estateId,
  reports,
  cursor,
  filtered,
  onClear,
  onRetry,
  onNext,
  onFirst,
}: {
  estateId: string;
  reports: PagedList<components["schemas"]["EstateIssueReportPageResponse"]>;
  cursor: string | undefined;
  filtered: boolean;
  onClear: () => void;
  onRetry: () => void;
  onNext: () => void;
  onFirst: () => void;
}) {
  const mobile = useMobile();
  const items = reports.data?.items ?? [];
  const list = mobile ? (
    <EstateReportsItems estateId={estateId} reports={items} />
  ) : (
    <EstateReportsTable estateId={estateId} reports={items} />
  );
  const rejectedPage =
    !!cursor &&
    reports.error instanceof ReportRequestError &&
    reports.error.status === 400;
  return (
    <>
      {reports.isPending ? <LoadingState label="Loading reports…" /> : null}
      {reports.isError ? (
        <ErrorState
          message={
            rejectedPage
              ? "Couldn't load this report page. Return to the first page."
              : "Couldn't load reports. Try again."
          }
          onRetry={rejectedPage ? onFirst : onRetry}
          retryLabel={rejectedPage ? "Return to first page" : "Retry"}
        />
      ) : null}
      {reports.data?.items.length === 0 ? (
        <ReportsEmpty filtered={filtered} onClear={onClear} />
      ) : null}
      {!reports.isError && items.length > 0 ? list : null}
      {reports.data && !reports.isError && reports.more ? (
        <LoadMore {...reports.more} />
      ) : null}
      {reports.data && !reports.isError && !reports.more ? (
        <Pagination
          canNext={!!reports.data.nextCursor}
          canPrevious={!!cursor}
          label="Report pages"
          onNext={onNext}
          onPrevious={onFirst}
        />
      ) : null}
    </>
  );
}
