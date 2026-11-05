import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardList } from "lucide-react";
import { useCallback } from "react";
import { ErrorState } from "@/components/error-state";
import { useFilterPanel } from "@/components/filter-bar";
import { ListPageHeader } from "@/components/list-page-header";
import { LoadingState } from "@/components/loading-state";
import { PageLayout } from "@/components/page-layout";
import { Pagination } from "@/components/pagination";
import { ReportCard } from "@/components/reports/report-card";
import {
  type EstateReportFilters,
  useEstateReportAccess,
  useEstateReportList,
  useEstateReportLocations,
} from "@/lib/estate-reports";
import { pageHead } from "@/lib/page-title";
import {
  countReportFilters,
  ReportFilters,
} from "./-components/report-filters";

import { ReportsEmpty } from "./-components/reports-empty";

const INTEGER_POSITION = /^-?\d+$/u;

export const Route = createFileRoute("/_auth/estates/$estateId/reports/")({
  validateSearch: (
    search: Record<string, unknown>
  ): EstateReportFilters & { cursor?: string } => {
    const minLevelPosition = position(search.minLevelPosition);
    const maxLevelPosition = position(search.maxLevelPosition);
    if (
      minLevelPosition !== undefined &&
      maxLevelPosition !== undefined &&
      minLevelPosition > maxLevelPosition
    ) {
      throw new Error("Minimum position must not exceed maximum position.");
    }
    return {
      ...(typeof search.blockId === "string" && search.blockId
        ? { blockId: search.blockId }
        : {}),
      ...(minLevelPosition === undefined ? {} : { minLevelPosition }),
      ...(maxLevelPosition === undefined ? {} : { maxLevelPosition }),
      ...(typeof search.cursor === "string" && search.cursor
        ? { cursor: search.cursor }
        : {}),
    };
  },
  component: EstateReportsPage,
  head: () => pageHead("Fault reports"),
});

function EstateReportsPage() {
  const { estateId } = Route.useParams();
  const { blockId, minLevelPosition, maxLevelPosition, cursor } =
    Route.useSearch();
  const filters = { blockId, minLevelPosition, maxLevelPosition };
  const activeCount = countReportFilters(filters);
  const filtered = activeCount > 0;
  const panel = useFilterPanel(activeCount);
  const navigate = Route.useNavigate();
  const access = useEstateReportAccess(estateId);
  const reports = useEstateReportList(estateId, filters, cursor);
  const locations = useEstateReportLocations(estateId);
  const filter = useCallback(
    (values: EstateReportFilters) => navigate({ search: values }),
    [navigate]
  );
  const clearFilters = useCallback(() => navigate({ search: {} }), [navigate]);
  const retry = useCallback(() => reports.refetch(), [reports.refetch]);
  const retryLocations = useCallback(
    () => locations.refetch(),
    [locations.refetch]
  );
  const next = useCallback(() => {
    navigate({
      search: {
        blockId,
        minLevelPosition,
        maxLevelPosition,
        cursor: reports.data?.nextCursor ?? undefined,
      },
    });
  }, [
    blockId,
    minLevelPosition,
    maxLevelPosition,
    navigate,
    reports.data?.nextCursor,
  ]);
  const first = useCallback(
    () => navigate({ search: { blockId, minLevelPosition, maxLevelPosition } }),
    [blockId, minLevelPosition, maxLevelPosition, navigate]
  );
  if (access.pending) {
    return <LoadingState label="Loading access…" rows={2} />;
  }
  if (!access.canView) {
    return <p role="alert">Fault reports are unavailable.</p>;
  }
  return (
    <PageLayout className="space-y-4">
      <ListPageHeader
        filters={{ activeCount, ...panel.toggleProps }}
        icon={ClipboardList}
        title="Fault reports"
      />
      {locations.data ? (
        <ReportFilters
          filters={filters}
          key={`${blockId ?? "all"}:${minLevelPosition ?? ""}:${maxLevelPosition ?? ""}`}
          locations={locations.data}
          onChange={filter}
          {...panel.barProps}
        />
      ) : null}
      {locations.isPending ? (
        <LoadingState label="Loading locations…" rows={1} />
      ) : null}
      {locations.isError ? (
        <ErrorState
          message="Unable to load locations"
          onRetry={retryLocations}
          retryLabel="Retry locations"
        />
      ) : null}
      {reports.isPending ? <LoadingState label="Loading reports…" /> : null}
      {reports.isError ? (
        <ErrorState message="Unable to load reports" onRetry={retry} />
      ) : null}
      {reports.data?.items.length === 0 ? (
        <ReportsEmpty filtered={filtered} onClear={clearFilters} />
      ) : null}
      {reports.isError
        ? null
        : reports.data?.items.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              title={
                <Link
                  params={{ estateId, reportId: report.id }}
                  to="/estates/$estateId/reports/$reportId"
                >
                  {report.title}
                </Link>
              }
            />
          ))}
      {reports.data && !reports.isError ? (
        <Pagination
          canNext={!!reports.data.nextCursor}
          canPrevious={!!cursor}
          label="Report pages"
          onNext={next}
          onPrevious={first}
        />
      ) : null}
    </PageLayout>
  );
}

function position(value: unknown): number | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }
  if (
    (typeof value !== "string" && typeof value !== "number") ||
    !INTEGER_POSITION.test(String(value))
  ) {
    throw new Error("Level positions must be whole numbers.");
  }
  const number = Number(value);
  if (
    !Number.isInteger(number) ||
    number < -2_147_483_648 ||
    number > 2_147_483_647
  ) {
    throw new Error("Level position is outside the supported integer range.");
  }
  return number;
}
