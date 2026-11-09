import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import { Field, FieldLabel } from "@proj/ui/components/field";
import { Textarea } from "@proj/ui/components/textarea";
import { useCallback, useId, useState } from "react";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { CompletionOutcome } from "@/components/work-orders/work-order-completion";
import {
  useCorrectWorkOrderCompletion,
  useSaveWorkOrderCompletion,
  type WorkOrder,
  type WorkOrderCompletionInput,
  type WorkOrderCorrectionInput,
} from "@/lib/work-orders";

import { CompletionFields } from "@/routes/_auth/estates/$estateId/work-orders/$workOrderId/-components/work-order-detail-page/completion-fields";

export function CompletionDialog({
  estateId,
  order,
  onClose,
  onRefresh,
}: {
  estateId: string;
  order: WorkOrder;
  onClose: () => void;
  onRefresh: () => unknown;
}) {
  const id = useId();
  const create = useSaveWorkOrderCompletion(estateId, order.id);
  const correct = useCorrectWorkOrderCompletion(estateId, order.id);
  const [initialOutcome] = useState(order.completion);
  const editing = !!initialOutcome;
  const mutation = editing ? correct : create;
  const [refreshing, setRefreshing] = useState(false);
  // Retain the version the user reviewed; a background refresh must not authorize an unseen overwrite.
  const [expectedVersion, setExpectedVersion] = useState(order.version);
  const [error, setError] = useState<string>();
  const [conflict, setConflict] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const submit = useCallback(
    async (element: HTMLFormElement) => {
      const form = new FormData(element);
      const value = (key: string) => String(form.get(key) ?? "").trim();
      const body = completionInput(form, expectedVersion);
      if (editing && !value("correctionReason")) {
        setError("Say why you're changing it.");
        return;
      }
      if (!(body.findings && body.workPerformed)) {
        setError("Enter findings and work performed.");
        return;
      }
      setError(undefined);
      try {
        if (editing) {
          await correct.mutateAsync(correctionInput(form, body));
        } else {
          await create.mutateAsync(body);
        }
        onClose();
      } catch (cause) {
        setConflict(
          cause instanceof Error && "status" in cause && cause.status === 409
        );
        setError(
          cause instanceof Error
            ? cause.message
            : "Couldn't save completion. Refresh to check whether it was saved before you try again."
        );
      }
    },
    [expectedVersion, editing, correct.mutateAsync, create.mutateAsync, onClose]
  );
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await onRefresh();
      setReviewing(true);
    } catch {
      setError("Couldn't refresh the work order and history. Try again.");
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);
  const review = useCallback(() => {
    setExpectedVersion(order.version);
    setConflict(false);
    setReviewing(false);
    setError(undefined);
  }, [order.version]);
  return (
    <FormDialog
      className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl"
      description={
        <>
          {editing
            ? "Fix the recorded details and say why. The order stays Closed. We keep the original and every change in its change history."
            : "Closing keeps this order Closed. Authorized owners and Managers can correct its recorded outcome later."}{" "}
          Leave optional costs and downtime blank if unknown; enter 0 for none.
          Costs are in SGD.
        </>
      }
      onClose={onClose}
      onSubmit={submit}
      open
      pending={mutation.isPending}
      submitDisabled={
        refreshing ||
        conflict ||
        order.status !== (editing ? "CLOSED" : "IN_PROGRESS")
      }
      submitLabel={editing ? "Save changes" : "Complete work order"}
      title={editing ? "Edit completion outcome" : "Complete work order"}
    >
      <CompletionFields id={id} initialOutcome={initialOutcome} />
      {editing ? (
        <Field>
          <FieldLabel htmlFor={`${id}-reason`}>
            Why you're changing it
          </FieldLabel>
          <Textarea
            id={`${id}-reason`}
            maxLength={500}
            name="correctionReason"
            required
          />
        </Field>
      ) : null}
      {error ? (
        <Alert className="rounded-xl" variant="destructive">
          <AlertDescription className="flex flex-col items-start gap-3">
            <p>{error}</p>
            <p>
              Refresh to check whether completion was saved before retrying.
            </p>
            <Button
              disabled={refreshing}
              onClick={refresh}
              type="button"
              variant="outline"
            >
              {refreshing ? "Refreshing…" : "Refresh work order"}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {reviewing ? (
        <Alert>
          <AlertDescription className="flex flex-col items-start gap-3">
            <p>Review the latest work order below before continuing.</p>
            <p>Current status: {order.status.replaceAll("_", " ")}</p>
            {editing && order.completion ? (
              <CompletionOutcome completion={order.completion} />
            ) : null}
            {order.status === (editing ? "CLOSED" : "IN_PROGRESS") ? (
              <Button onClick={review} type="button" variant="outline">
                I reviewed the updated work order
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}
    </FormDialog>
  );
}

function completionInput(
  form: FormData,
  expectedVersion: number
): WorkOrderCompletionInput {
  const value = (key: string) => String(form.get(key) ?? "").trim();
  const body: WorkOrderCompletionInput = {
    expectedVersion,
    findings: value("findings"),
    workPerformed: value("workPerformed"),
    ...(value("partsUsed") ? { partsUsed: value("partsUsed") } : {}),
    ...(value("labourCost") ? { labourCost: value("labourCost") } : {}),
    ...(value("partsCost") ? { partsCost: value("partsCost") } : {}),
    ...(value("downtimeMinutes")
      ? { downtimeMinutes: Number(value("downtimeMinutes")) }
      : {}),
  };
  return body;
}
function correctionInput(
  form: FormData,
  body: WorkOrderCompletionInput
): WorkOrderCorrectionInput {
  const value = (key: string) => String(form.get(key) ?? "").trim();
  return {
    ...body,
    correctionReason: value("correctionReason"),
    partsUsed: value("partsUsed") || null,
    labourCost: value("labourCost") || null,
    partsCost: value("partsCost") || null,
    downtimeMinutes: value("downtimeMinutes")
      ? Number(value("downtimeMinutes"))
      : null,
  };
}
