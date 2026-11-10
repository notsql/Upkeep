import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@proj/ui/components/dialog";
import { useCallback, useState } from "react";
import { useDismissReport } from "@/lib/report-routing";

export function DismissReportDialog({
  estateId,
  reportId,
}: {
  estateId: string;
  reportId: string;
}) {
  const [open, setOpen] = useState(false);
  const dismiss = useDismissReport(estateId, reportId);
  const confirm = useCallback(
    () => dismiss.mutate(undefined, { onSuccess: () => setOpen(false) }),
    [dismiss]
  );
  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger render={<Button variant="outline" />}>
        Dismiss
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dismiss this report?</DialogTitle>
          <DialogDescription>
            No contractor is emailed. Handle the fault another way; this report
            cannot be sent to a contractor afterwards.
          </DialogDescription>
        </DialogHeader>
        {dismiss.isError ? (
          <Alert role="alert" variant="destructive">
            <AlertDescription>{dismiss.error.message}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button
            disabled={dismiss.isPending}
            onClick={confirm}
            variant="destructive"
          >
            Dismiss report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
