import { Alert, AlertDescription, AlertTitle } from "@proj/ui/components/alert";
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
  DialogHeader,
  DialogTitle,
} from "@proj/ui/components/dialog";
import { Field, FieldLabel } from "@proj/ui/components/field";
import { Input } from "@proj/ui/components/input";
import { Textarea } from "@proj/ui/components/textarea";
import { type FormEvent, useCallback, useId, useState } from "react";
import { CompletionOutcome } from "@/components/work-order-completion";
import {
  useChangeWorkOrderStatus,
  useCorrectWorkOrderCompletion,
  useSaveWorkOrderCompletion,
  useWorkOrderCompletionRevisions,
  useWorkOrderStatusHistory,
  type WorkOrder,
  type WorkOrderCompletionInput,
  type WorkOrderCompletionRevision,
  type WorkOrderCorrectionInput,
} from "@/lib/work-orders";

export function WorkOrderProgress({
  estateId,
  order,
  canUpdate,
  onRefresh,
}: {
  estateId: string;
  order: WorkOrder;
  canUpdate: boolean;
  onRefresh: () => unknown;
}) {
  const change = useChangeWorkOrderStatus(estateId, order.id);
  const history = useWorkOrderStatusHistory(estateId, order.id);
  const revisions = useWorkOrderCompletionRevisions(
    estateId,
    order.id,
    !!order.completion
  );
  const retryRevisions = useCallback(
    () => revisions.refetch(),
    [revisions.refetch]
  );
  const [error, setError] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);
  const [completing, setCompleting] = useState(false);
  const openCompletion = useCallback(() => setCompleting(true), []);
  const closeCompletion = useCallback(() => setCompleting(false), []);
  const retryHistory = useCallback(() => history.refetch(), [history.refetch]);
  const refreshOrder = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        onRefresh(),
        history.refetch({ throwOnError: true }),
        ...(order.completion
          ? [revisions.refetch({ throwOnError: true })]
          : []),
      ]);
      setError(undefined);
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh, history.refetch, order.completion, revisions.refetch]);
  const recover = useCallback(async () => {
    try {
      await refreshOrder();
    } catch {
      setError(
        "Unable to refresh the work order and history. Please try again."
      );
    }
  }, [refreshOrder]);
  const start = useCallback(async () => {
    setError(undefined);
    try {
      await change.mutateAsync({
        targetStatus: "IN_PROGRESS",
        expectedVersion: order.version,
      });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to start work."
      );
    }
  }, [change.mutateAsync, order.version]);
  return (
    <>
      {canUpdate ? (
        <div className="flex flex-wrap gap-2">
          {order.status === "OPEN" || order.status === "ASSIGNED" ? (
            <Button disabled={change.isPending} onClick={start}>
              Start work
            </Button>
          ) : null}
          {order.status === "IN_PROGRESS" ? (
            <Button onClick={openCompletion}>Complete work order</Button>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <Alert className="rounded-xl">
          <AlertTitle>Review the latest work order</AlertTitle>
          <AlertDescription className="mt-2 flex flex-col items-start gap-3">
            <p>{error}</p>
            <Button disabled={refreshing} onClick={recover} variant="outline">
              {refreshing ? "Refreshing…" : "Refresh work order"}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {order.completion ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Completion outcome</h2>
            </CardTitle>
            {canUpdate ? (
              <Button
                className="w-fit"
                onClick={openCompletion}
                variant="outline"
              >
                Edit outcome
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            <CompletionOutcome completion={order.completion} />
          </CardContent>
        </Card>
      ) : null}
      <StatusHistory history={history} onRetry={retryHistory} />
      {order.completion ? (
        <OutcomeCorrections onRetry={retryRevisions} revisions={revisions} />
      ) : null}
      {completing && canUpdate ? (
        <CompletionDialog
          estateId={estateId}
          onClose={closeCompletion}
          onRefresh={refreshOrder}
          order={order}
        />
      ) : null}
    </>
  );
}

function StatusHistory({
  history,
  onRetry,
}: {
  history: ReturnType<typeof useWorkOrderStatusHistory>;
  onRetry: () => unknown;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Status history</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {history.isPending ? (
          <p role="status">Loading status history…</p>
        ) : null}
        {history.isError ? (
          <Alert variant="destructive">
            <AlertDescription>
              Unable to load status history.{" "}
              <Button onClick={onRetry} variant="outline">
                Retry history
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}
        {!history.isError && history.data ? (
          <ol className="space-y-4">
            {history.data.map((event) => (
              <li key={event.id}>
                <p>
                  {event.fromStatus
                    ? `${event.fromStatus.replaceAll("_", " ")} → `
                    : "Created · "}
                  {event.toStatus.replaceAll("_", " ")}
                </p>
                <p className="text-muted-foreground">
                  {event.changedByName ?? "Name unavailable"} ·{" "}
                  <time dateTime={event.changedAt}>
                    {new Date(event.changedAt).toLocaleString()}
                  </time>
                </p>
              </li>
            ))}
          </ol>
        ) : null}
      </CardContent>
    </Card>
  );
}
function OutcomeCorrections({
  revisions,
  onRetry,
}: {
  revisions: ReturnType<typeof useWorkOrderCompletionRevisions>;
  onRetry: () => unknown;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Outcome corrections</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {revisions.isPending ? (
          <p role="status">Loading outcome corrections…</p>
        ) : null}
        {revisions.isError ? (
          <Alert variant="destructive">
            <AlertDescription className="space-y-3">
              <p>Unable to load outcome corrections.</p>
              <Button onClick={onRetry} variant="outline">
                Retry corrections
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}
        {!revisions.isError && revisions.data?.length === 0 ? (
          <p className="text-muted-foreground">No corrections recorded.</p>
        ) : null}
        {revisions.isError
          ? null
          : revisions.data?.map((revision) => (
              <OutcomeRevision key={revision.id} revision={revision} />
            ))}
      </CardContent>
    </Card>
  );
}

function OutcomeRevision({
  revision,
}: {
  revision: WorkOrderCompletionRevision;
}) {
  const [expanded, setExpanded] = useState(false);
  const toggle = useCallback(() => setExpanded((value) => !value), []);
  const id = useId();
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <p className="whitespace-pre-wrap break-words font-medium">
        {revision.correctionReason}
      </p>
      <p className="text-muted-foreground">
        {revision.changedByName ?? "Name unavailable"} ·{" "}
        <time dateTime={revision.changedAt}>
          {new Date(revision.changedAt).toLocaleString()}
        </time>
      </p>
      <Button
        aria-controls={id}
        aria-expanded={expanded}
        onClick={toggle}
        variant="outline"
      >
        {expanded ? "Hide before and after" : "View before and after"}
      </Button>
      {expanded ? (
        <div className="grid gap-6 lg:grid-cols-2" id={id}>
          <section aria-label="Before correction">
            <h3 className="mb-3 font-medium">Before correction</h3>
            <CompletionOutcome completion={revision.before} />
          </section>
          <section aria-label="After correction">
            <h3 className="mb-3 font-medium">After correction</h3>
            <CompletionOutcome completion={revision.after} />
          </section>
        </div>
      ) : null}
    </div>
  );
}

function CompletionDialog({
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
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const value = (key: string) => String(form.get(key) ?? "").trim();
      const body = completionInput(form, expectedVersion);
      if (editing && !value("correctionReason")) {
        setError("Enter a correction reason.");
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
            : "Unable to save completion. Refresh to check whether it was saved before retrying."
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
      setError(
        "Unable to refresh the work order and history. Please try again."
      );
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
  const changeOpen = useCallback(
    (open: boolean) => {
      if (!(open || mutation.isPending)) {
        onClose();
      }
    },
    [mutation.isPending, onClose]
  );
  return (
    <Dialog onOpenChange={changeOpen} open>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl"
        showCloseButton={!mutation.isPending}
      >
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit completion outcome" : "Complete work order"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Correct the recorded details and give a reason. The order stays Closed; the original completion and every correction remain in its audit."
              : "Closing keeps this order Closed. Authorized owners and Managers can correct its recorded outcome later."}{" "}
            Leave optional costs and downtime blank if unknown; enter 0 for
            none. Costs are in SGD.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <CompletionFields id={id} initialOutcome={initialOutcome} />
          {editing ? (
            <Field>
              <FieldLabel htmlFor={`${id}-reason`}>
                Correction reason
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
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              disabled={mutation.isPending}
              onClick={onClose}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={
                mutation.isPending ||
                refreshing ||
                conflict ||
                order.status !== (editing ? "CLOSED" : "IN_PROGRESS")
              }
              type="submit"
            >
              {editing ? "Save correction" : "Complete work order"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CompletionFields({
  id,
  initialOutcome,
}: {
  id: string;
  initialOutcome: WorkOrder["completion"];
}) {
  return (
    <>
      <Field>
        <FieldLabel htmlFor={`${id}-findings`}>Findings</FieldLabel>
        <Textarea
          defaultValue={initialOutcome?.findings}
          id={`${id}-findings`}
          maxLength={2500}
          name="findings"
          required
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-work`}>Work performed</FieldLabel>
        <Textarea
          defaultValue={initialOutcome?.workPerformed}
          id={`${id}-work`}
          maxLength={2500}
          name="workPerformed"
          required
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-parts`}>Parts used</FieldLabel>
        <Textarea
          defaultValue={initialOutcome?.partsUsed ?? ""}
          id={`${id}-parts`}
          maxLength={2500}
          name="partsUsed"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={`${id}-labour`}>Labour cost (SGD)</FieldLabel>
          <Input
            defaultValue={initialOutcome?.labourCost ?? ""}
            id={`${id}-labour`}
            inputMode="decimal"
            name="labourCost"
            pattern="[0-9]{1,12}([.][0-9]{1,2})?"
            placeholder="Unknown"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-cost`}>Parts cost (SGD)</FieldLabel>
          <Input
            defaultValue={initialOutcome?.partsCost ?? ""}
            id={`${id}-cost`}
            inputMode="decimal"
            name="partsCost"
            pattern="[0-9]{1,12}([.][0-9]{1,2})?"
            placeholder="Unknown"
          />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor={`${id}-downtime`}>Downtime (minutes)</FieldLabel>
        <Input
          defaultValue={initialOutcome?.downtimeMinutes ?? ""}
          id={`${id}-downtime`}
          max={2_147_483_647}
          min={0}
          name="downtimeMinutes"
          placeholder="Unknown"
          step={1}
          type="number"
        />
      </Field>
    </>
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
