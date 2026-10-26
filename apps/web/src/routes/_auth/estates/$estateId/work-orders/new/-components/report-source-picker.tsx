import { Button } from "@proj/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@proj/ui/components/dialog";
import { Field, FieldLabel } from "@proj/ui/components/field";
import { type MouseEvent, useCallback, useId, useState } from "react";
import {
  type EstateReportFilters,
  useEstateReportList,
} from "@/lib/estate-reports";
import { useLocations } from "@/lib/locations";
import { ReportFilters } from "@/routes/_auth/estates/$estateId/reports/-components/report-filters";

export function ReportSourcePicker({
  estateId,
  value,
  onChange,
  selectedTitle,
}: {
  estateId: string;
  value: string;
  onChange: (id: string) => void;
  selectedTitle?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState<string | undefined>(undefined);
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
  const choose = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const chosen = reports.data?.items.find(
        (report) => report.id === event.currentTarget.value
      );
      if (!chosen) {
        return;
      }
      setLabel(chosen.title);
      onChange(chosen.id);
      setOpen(false);
    },
    [reports.data?.items, onChange]
  );
  return (
    <Field>
      <FieldLabel htmlFor={id}>Resident report</FieldLabel>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogTrigger
          render={
            <Button
              className="h-auto min-h-11 justify-start whitespace-normal text-left"
              id={id}
              type="button"
              variant="outline"
            />
          }
        >
          {selectedTitle ??
            label ??
            (value ? "Selected report" : "Choose resident report")}
        </DialogTrigger>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Choose resident report</DialogTitle>
            <DialogDescription>
              Filter reports by block and level position, then choose a report.
            </DialogDescription>
          </DialogHeader>
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
              <div className="grid max-h-72 gap-2 overflow-y-auto">
                {reports.data.items.map((report) => (
                  <Button
                    aria-pressed={report.id === value}
                    className="h-auto min-h-11 justify-start whitespace-normal text-left"
                    key={report.id}
                    onClick={choose}
                    type="button"
                    value={report.id}
                    variant="outline"
                  >
                    {report.title}
                  </Button>
                ))}
              </div>
              {reports.data.items.length === 0 ? (
                <p>
                  No reports match these filters. You can create a manual work
                  order instead.
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
        </DialogContent>
      </Dialog>
    </Field>
  );
}
