import { Button } from "@proj/ui/components/button";
import { useCallback, useState } from "react";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import {
  type EstateReport,
  useEstateReportLocations,
} from "@/lib/estate-reports";

import { LocationEditor } from "@/routes/_auth/estates/$estateId/reports/$reportId/-components/change-location-dialog/location-editor";

export function ChangeLocationDialog({
  estateId,
  report,
  reload,
}: {
  estateId: string;
  report: EstateReport;
  reload: () => Promise<EstateReport | undefined>;
}) {
  const [open, setOpen] = useState(false);
  const locations = useEstateReportLocations(estateId);
  const close = useCallback(() => setOpen(false), []);
  const openEditor = useCallback(() => setOpen(true), []);
  const retry = useCallback(() => locations.refetch(), [locations.refetch]);
  if (locations.isPending) {
    return <LoadingState label="Loading correction locations…" rows={1} />;
  }
  if (locations.isError) {
    return (
      <ErrorState
        message="Unable to load locations"
        onRetry={retry}
        retryLabel="Retry locations"
      />
    );
  }
  return (
    <>
      <Button onClick={openEditor} type="button" variant="outline">
        Change location
      </Button>
      {open && locations.data ? (
        <LocationEditor
          close={close}
          estateId={estateId}
          locations={locations.data}
          reload={reload}
          report={report}
        />
      ) : null}
    </>
  );
}
