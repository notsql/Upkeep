import type { components } from "@proj/api/schema";
import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@proj/ui/components/card";
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
  dispatchStatusLabel,
  EQUIPMENT_TYPES,
  type EquipmentType,
  equipmentLabel,
  useDispatchWorkOrder,
  useRetryDispatch,
  useWorkOrderDispatch,
} from "@/lib/report-routing";

type WorkOrder = components["schemas"]["WorkOrderResponse"];

/** Only open equipment faults from a resident report can be emailed to a contractor (ID-70). */
export function canEmailContractor(order: WorkOrder): boolean {
  return (
    order.category === "EQUIPMENT_FAULT" &&
    order.source === "RESIDENT_REPORT" &&
    order.status === "OPEN"
  );
}

function EmailContractorDialog({
  estateId,
  workOrderId,
}: {
  estateId: string;
  workOrderId: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<EquipmentType | null>(null);
  const contractors = useContractors(estateId);
  const dispatch = useDispatchWorkOrder(estateId, workOrderId);
  const contractor = contractors.data?.find(
    (item) => item.equipmentType === type
  );
  const choose = useCallback(
    (value: EquipmentType | null) => setType(value),
    []
  );
  const submit = useCallback(() => {
    if (type) {
      dispatch.mutate(type, { onSuccess: () => setOpen(false) });
    }
  }, [dispatch, type]);
  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger render={<Button />}>Email contractor</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Email contractor</DialogTitle>
          <DialogDescription>
            Assigns this work order to the equipment type's contractor and
            emails them the resident's words and photos.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor={id}>Equipment type</Label>
          <Select
            disabled={dispatch.isPending}
            items={EQUIPMENT_TYPES}
            onValueChange={choose}
            value={type}
          >
            <SelectTrigger className="w-full" id={id}>
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
            {contractor.name} ({contractor.email}) will be assigned and emailed.
          </p>
        ) : null}
        {dispatch.isError ? (
          <Alert role="alert" variant="destructive">
            <AlertDescription>{dispatch.error.message}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button disabled={!contractor || dispatch.isPending} onClick={submit}>
            Assign and email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function WorkOrderContractorEmail({
  estateId,
  order,
  canCreate,
}: {
  estateId: string;
  order: WorkOrder;
  canCreate: boolean;
}) {
  const dispatch = useWorkOrderDispatch(estateId, order.id);
  const retry = useRetryDispatch(estateId);
  const retrySend = useCallback(
    () => retry.mutate(order.id),
    [retry, order.id]
  );
  const { data } = dispatch;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="font-semibold">Contractor email</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {dispatch.isPending ? (
          <p role="status">Loading contractor email…</p>
        ) : null}
        {dispatch.isError ? (
          <Alert role="alert" variant="destructive">
            <AlertDescription>{dispatch.error.message}</AlertDescription>
          </Alert>
        ) : null}
        {data ? (
          <dl className="grid gap-2 sm:grid-cols-[max-content_1fr] sm:gap-x-4">
            <dt className="text-muted-foreground">Contractor</dt>
            <dd className="wrap-anywhere">
              {data.contractorName} ({data.contractorEmail})
            </dd>
            <dt className="text-muted-foreground">Equipment</dt>
            <dd>{equipmentLabel(data.equipmentType)}</dd>
            <dt className="text-muted-foreground">Email</dt>
            <dd>{dispatchStatusLabel(data)}</dd>
            <dt className="text-muted-foreground">Approval</dt>
            <dd>
              {data.approval === "AUTOMATIC"
                ? "Sent automatically"
                : "Approved by a manager"}
            </dd>
          </dl>
        ) : null}
        {data === null ? (
          <p className="text-muted-foreground">
            No contractor has been emailed about this work order.
          </p>
        ) : null}
        {canCreate && data === null && canEmailContractor(order) ? (
          <div>
            <EmailContractorDialog estateId={estateId} workOrderId={order.id} />
          </div>
        ) : null}
        {canCreate && data?.status === "FAILED" ? (
          <div>
            <Button
              disabled={retry.isPending}
              onClick={retrySend}
              variant="outline"
            >
              Retry sending
            </Button>
          </div>
        ) : null}
        {retry.isError ? (
          <Alert role="alert" variant="destructive">
            <AlertDescription>{retry.error.message}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
