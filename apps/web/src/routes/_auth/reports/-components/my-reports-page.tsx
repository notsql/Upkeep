import { ClipboardList } from "lucide-react";
import { useCallback, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import {
  CreateButton,
  type CreateButtonProps,
} from "@/components/page-actions";
import { ListPageHeader } from "@/components/page-header";
import { PageLayout } from "@/components/page-layout";
import { Pagination } from "@/components/pagination";
import { ReportCard } from "@/components/reports/report-card";
import { useAuthenticatedSession } from "@/lib/access";
import { useReportList } from "@/lib/reports";

interface HistoryProps {
  estateId?: string;
}
export function MyReportsPage(props: HistoryProps) {
  const { userId } = useAuthenticatedSession();
  return (
    <ReportHistory key={`${userId}:${props.estateId ?? "all"}`} {...props} />
  );
}
function ReportHistory({ estateId }: HistoryProps) {
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
          action={<CreateButton {...create} />}
          description="Reported faults appear here"
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
