import { Button } from "@proj/ui/components/button";
import { useCallback, useState } from "react";
import type { EstateReport } from "@/lib/estate-reports";
import { UrgencyEditor } from "@/routes/_auth/estates/$estateId/reports/$reportId/-components/change-urgency-dialog/urgency-editor";

export function ChangeUrgencyDialog({
  estateId,
  report,
  reload,
}: {
  estateId: string;
  report: EstateReport;
  reload: () => Promise<EstateReport | undefined>;
}) {
  const [open, setOpen] = useState(false);
  const show = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <Button onClick={show} type="button" variant="outline">
        Change urgency
      </Button>
      {open ? (
        <UrgencyEditor
          close={close}
          estateId={estateId}
          key={report.id}
          reload={reload}
          report={report}
        />
      ) : null}
    </>
  );
}
