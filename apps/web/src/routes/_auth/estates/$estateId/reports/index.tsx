import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Badge } from "@proj/ui/components/badge";
import { Button } from "@proj/ui/components/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { ReportCard } from "@/components/reports/report-card";
import {
  type EstateReportFilters,
  useEstateReportAccess,
  useEstateReportList,
  useEstateReportLocations,
} from "@/lib/estate-reports";
import {
  ROUTING_STATES,
  type RoutingState,
  routingStateLabel,
} from "@/lib/report-routing";
import { ReportFilters } from "./-components/report-filters";
import { RoutingStateFilter } from "./-components/routing-state-filter";

const INTEGER_POSITION = /^-?\d+$/;

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
      ...(parseRoutingState(search.routingState)
        ? { routingState: parseRoutingState(search.routingState) }
        : {}),
      ...(typeof search.cursor === "string" && search.cursor
        ? { cursor: search.cursor }
        : {}),
    };
  },
  component: EstateReportsPage,
  head: () => ({ meta: [{ title: "Fault reports" }] }),
});

function EstateReportsPage() {
  const { estateId } = Route.useParams();
  const { blockId, minLevelPosition, maxLevelPosition, routingState, cursor } =
    Route.useSearch();
  const filters = { blockId, minLevelPosition, maxLevelPosition };
  const filtered =
    !!blockId ||
    minLevelPosition !== undefined ||
    maxLevelPosition !== undefined ||
    !!routingState;
  const navigate = Route.useNavigate();
  const access = useEstateReportAccess(estateId);
  const reports = useEstateReportList(
    estateId,
    { ...filters, routingState },
    cursor
  );
  const locations = useEstateReportLocations(estateId);
  const filter = useCallback(
    (values: EstateReportFilters) =>
      navigate({ search: { ...values, routingState } }),
    [navigate, routingState]
  );
  const filterRouting = useCallback(
    (value: RoutingState | undefined) =>
      navigate({
        search: {
          blockId,
          minLevelPosition,
          maxLevelPosition,
          routingState: value,
        },
      }),
    [blockId, minLevelPosition, maxLevelPosition, navigate]
  );
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
        routingState,
        cursor: reports.data?.nextCursor ?? undefined,
      },
    });
  }, [
    blockId,
    minLevelPosition,
    maxLevelPosition,
    routingState,
    navigate,
    reports.data?.nextCursor,
  ]);
  const first = useCallback(
    () =>
      navigate({
        search: { blockId, minLevelPosition, maxLevelPosition, routingState },
      }),
    [blockId, minLevelPosition, maxLevelPosition, routingState, navigate]
  );
  if (access.pending) {
    return <p role="status">Loading access…</p>;
  }
  if (!access.canView) {
    return <p role="alert">Fault reports are unavailable.</p>;
  }
  return (
    <main className="page-layout space-y-4">
      <PageHeader
        breadcrumbs={[
          { label: "Estates", to: "/estates" },
          {
            label: access.estateName ?? "Estate",
            to: access.canViewManagement ? "/estates/$estateId" : undefined,
            params: { estateId },
          },
          { label: "Fault reports" },
        ]}
        title="Fault reports"
      />
      {locations.data ? (
        <ReportFilters
          filters={filters}
          key={`${blockId ?? "all"}:${minLevelPosition ?? ""}:${maxLevelPosition ?? ""}`}
          locations={locations.data}
          onChange={filter}
        />
      ) : null}
      <RoutingStateFilter onChange={filterRouting} value={routingState} />
      {locations.isPending ? <p role="status">Loading locations…</p> : null}
      {locations.isError ? (
        <Alert role="alert">
          <AlertDescription>
            Unable to load locations.{" "}
            <Button onClick={retryLocations} variant="outline">
              Retry locations
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {reports.isPending ? <p role="status">Loading reports…</p> : null}
      {reports.isError ? (
        <Alert role="alert" variant="destructive">
          <AlertDescription>
            Unable to load reports.{" "}
            <Button onClick={retry} variant="outline">
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {reports.data?.items.length === 0 ? (
        <p>{filtered ? "No matching reports." : "No reports yet."}</p>
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
            >
              {report.routing ? (
                <div>
                  <Badge variant="outline">
                    Routing: {routingStateLabel(report.routing.state)}
                  </Badge>
                </div>
              ) : null}
            </ReportCard>
          ))}
      <div className="flex gap-2">
        {cursor ? (
          <Button onClick={first} variant="outline">
            First page
          </Button>
        ) : null}
        {reports.data?.nextCursor ? (
          <Button onClick={next} variant="outline">
            Next
          </Button>
        ) : null}
      </div>
    </main>
  );
}

function parseRoutingState(value: unknown): RoutingState | undefined {
  return ROUTING_STATES.find((state) => state.value === value)?.value;
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
