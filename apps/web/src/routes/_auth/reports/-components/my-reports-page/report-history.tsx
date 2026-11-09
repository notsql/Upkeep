import { ClipboardList } from "lucide-react";
import { useCallback, useState } from "react";
import { ListPageHeader } from "@/components/page/list-page-header";
import type { CreateButtonProps } from "@/components/page/page-actions";
import { PageLayout } from "@/components/page/page-layout";
import { ReportCard } from "@/components/reports/report-card";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { Pagination } from "@/components/table/pagination";
import { useReportList } from "@/lib/reports";

export interface HistoryProps {
  estateId?: string;
}

export function ReportHistory({ estateId }: HistoryProps) {
  const [cursor, setCursor] = useState<string>();
  const [previous, setPrevious] = useState<(string | undefined)[]>([]);
  const reports = useReportList(cursor, estateId);
  const retry = useCallback(() => reports.refetch(), [reports.refetch]);
  const goPrevious = useCallback(() => {
    setCursor(previous.at(-1));
    setPrevious((pages) => pages.slice(0, -1));
  }, [previous]);
  const goNext = useCallback(() => {
    setPrevious((pages) => [...pages, cursor]);
    setCursor(reports.data?.nextCursor ?? undefined);
  }, [cursor, reports.data?.nextCursor]);
  const create: CreateButtonProps = {
    search: estateId ? { estateId } : {},
    to: "/reports/new",
  };

  return (
    <PageLayout>
      <ListPageHeader
        create={create}
        description={
          estateId ? "Reports for this estate" : "Reports across all estates"
        }
        icon={ClipboardList}
        title="My reports"
      />
      {reports.isPending ? <LoadingState label="Loading reports…" /> : null}
      {reports.isError ? (
        <ErrorState message="Unable to load reports" onRetry={retry} />
      ) : null}
      {reports.data && (reports.data.items?.length ?? 0) === 0 ? (
        <EmptyState
          description="Use Create to report the first fault"
          icon={ClipboardList}
          title={estateId ? "No reports for this estate yet" : "No reports yet"}
        />
      ) : null}
      <div className="grid gap-4">
        {reports.data?.items?.map((report) => (
          <ReportCard
            key={report.id}
            report={report}
            title={
              <a
                href={`/reports/${report.id}${estateId ? `?estateId=${encodeURIComponent(estateId)}` : ""}`}
              >
                {report.title}
              </a>
            }
          />
        ))}
      </div>
      {reports.data?.items?.length ? (
        <div className="mt-4">
          <Pagination
            canNext={Boolean(reports.data.nextCursor)}
            canPrevious={previous.length > 0}
            label="Report pages"
            onNext={goNext}
            onPrevious={goPrevious}
          />
        </div>
      ) : null}
    </PageLayout>
  );
}
