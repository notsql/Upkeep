import { Button } from "@proj/ui/components/button";
import { useCallback, useState } from "react";
import {
  type EstateReportFilters,
  useEstateReportList,
} from "@/lib/estate-reports";
import { useLocations } from "@/lib/locations";
import { ReportFilters } from "@/routes/_auth/estates/$estateId/reports/-components/report-filters";
import { WorkOrderSelect } from "./work-order-select";

export function ReportSourcePicker({
  estateId,
  value,
  onChange,
}: {
  estateId: string;
  value: string;
  onChange: (id: string) => void;
}) {
  const [filters, setFilters] = useState<EstateReportFilters>({});
  const [cursor, setCursor] = useState<string>();
  const reports = useEstateReportList(estateId, filters, cursor);
  const locations = useLocations(estateId, true);
  const changeFilters = useCallback((nextFilters: EstateReportFilters) => {
    setFilters(nextFilters);
    setCursor(undefined);
  }, []);
  const retry = useCallback(() => reports.refetch(), [reports.refetch]);
  const first = useCallback(() => setCursor(undefined), []);
  const next = useCallback(
    () => setCursor(reports.data?.nextCursor ?? undefined),
    [reports.data?.nextCursor]
  );
  return (
    <section aria-label="Choose a resident report" className="grid gap-4">
      {locations.data && !locations.isError ? (
        <ReportFilters
          filters={filters}
          locations={locations.data}
          onChange={changeFilters}
        />
      ) : null}
      {reports.isPending ? (
        <p role="status">Loading resident reports…</p>
      ) : null}
      {reports.isError ? (
        <p role="alert">
          Unable to load reports.{" "}
          <Button onClick={retry} type="button" variant="outline">
            Retry reports
          </Button>
        </p>
      ) : null}
      {reports.data && !reports.isError ? (
        <>
          <WorkOrderSelect
            label="Resident report"
            onChange={onChange}
            options={reports.data.items.map((report) => ({
              value: report.id,
              label: report.title,
            }))}
            value={value}
          />
          {reports.data.items.length === 0 ? (
            <p>
              No reports match these filters. You can create a manual work order
              instead.
            </p>
          ) : null}
          <div className="flex gap-2">
            {cursor ? (
              <Button onClick={first} type="button" variant="outline">
                First report page
              </Button>
            ) : null}
            {reports.data.nextCursor ? (
              <Button onClick={next} type="button" variant="outline">
                Next reports
              </Button>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}
