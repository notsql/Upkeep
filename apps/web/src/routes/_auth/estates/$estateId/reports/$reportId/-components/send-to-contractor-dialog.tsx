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
import { Label } from "@proj/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";
import { Link } from "@tanstack/react-router";
import { useCallback, useId, useState } from "react";
import { useContractors } from "@/lib/contractors";
import {
  EQUIPMENT_TYPES,
  type EquipmentType,
  equipmentLabel,
  PRIORITIES,
  useSendToContractor,
  type WorkOrderPriority,
} from "@/lib/report-routing";

export function SendToContractorDialog({
  estateId,
  reportId,
  suggested,
}: {
  estateId: string;
  reportId: string;
  suggested: EquipmentType | null;
}) {
  const typeId = useId();
  const priorityId = useId();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<EquipmentType | null>(suggested);
  const [priority, setPriority] = useState<WorkOrderPriority>("MEDIUM");
  const contractors = useContractors(estateId);
  const send = useSendToContractor(estateId, reportId);
  const contractor = contractors.data?.find(
    (item) => item.equipmentType === type
  );
  const chooseType = useCallback(
    (value: EquipmentType | null) => setType(value),
    []
  );
  const choosePriority = useCallback(
    (value: WorkOrderPriority | null) => setPriority(value ?? "MEDIUM"),
    []
  );
  const submit = useCallback(() => {
    if (!type) {
      return;
    }
    send.mutate(
      { equipmentType: type, priority },
      { onSuccess: () => setOpen(false) }
    );
  }, [priority, send, type]);
  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger render={<Button />}>Send to contractor</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send to contractor</DialogTitle>
          <DialogDescription>
            Creates a work order from this report, assigns it to the equipment
            type's contractor and emails them.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor={typeId}>Equipment type</Label>
          <Select
            disabled={send.isPending}
            items={EQUIPMENT_TYPES}
            onValueChange={chooseType}
            value={type}
          >
            <SelectTrigger className="w-full" id={typeId}>
              <SelectValue placeholder="Choose equipment type" />
            </SelectTrigger>
            <SelectContent>
              {EQUIPMENT_TYPES.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={priorityId}>Priority</Label>
          <Select
            disabled={send.isPending}
            items={PRIORITIES}
            onValueChange={choosePriority}
            value={priority}
          >
            <SelectTrigger className="w-full" id={priorityId}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {contractors.isPending ? (
          <p role="status">Loading contractors…</p>
        ) : null}
        {type && contractors.data && !contractor ? (
          <p>
            No {equipmentLabel(type).toLowerCase()} contractor is set up for
            this estate.{" "}
            <Link params={{ estateId }} to="/estates/$estateId/contractors">
              Set up contractors
            </Link>
          </p>
        ) : null}
        {contractor ? (
          <p className="wrap-anywhere">
            {contractor.name} ({contractor.email}) will receive the resident's
            words and photos.
          </p>
        ) : null}
        {send.isError ? (
          <Alert role="alert" variant="destructive">
            <AlertDescription>{send.error.message}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button disabled={!contractor || send.isPending} onClick={submit}>
            Send work order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
