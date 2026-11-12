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
import { type Contractor, useRemoveContractor } from "@/lib/contractors";

export function RemoveContractorDialog({
  estateId,
  contractor,
}: {
  estateId: string;
  contractor: Contractor;
}) {
  const [open, setOpen] = useState(false);
  const remove = useRemoveContractor(estateId);
  const confirm = useCallback(
    () => remove.mutate(contractor.id, { onSuccess: () => setOpen(false) }),
    [contractor.id, remove]
  );
  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger
        render={
          <Button
            aria-label={`Remove ${contractor.name}`}
            size="sm"
            variant="outline"
          />
        }
      >
        Remove
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove {contractor.name}?</DialogTitle>
          <DialogDescription>
            They will no longer appear when you give out a job. Jobs they
            already finished keep their name.
          </DialogDescription>
        </DialogHeader>
        {remove.isError ? (
          <Alert role="alert" variant="destructive">
            <AlertDescription>{remove.error.message}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button
            disabled={remove.isPending}
            onClick={confirm}
            variant="destructive"
          >
            Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
