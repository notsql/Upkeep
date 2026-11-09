import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import { Checkbox } from "@proj/ui/components/checkbox";
import { Field, FieldLabel } from "@proj/ui/components/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";
import { useCallback, useId, useRef, useState } from "react";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { urgencyLabels } from "@/components/reports/urgency-labels";
import {
  type EstateReport,
  ReportRequestError,
  useChangeEstateReportUrgency,
} from "@/lib/estate-reports";

export function UrgencyEditor({
  estateId,
  report,
  reload,
  close,
}: {
  estateId: string;
  report: EstateReport;
  reload: () => Promise<EstateReport | undefined>;
  close: () => void;
}) {
  const id = useId();
  const [observed, setObserved] = useState(report);
  const [urgency, setUrgency] = useState(report.urgency);
  const [isSafety, setSafety] = useState(report.isSafety);
  const [reloading, setReloading] = useState(false);
  const [reloadError, setReloadError] = useState<string>();
  const saving = useRef(false);
  const mutation = useChangeEstateReportUrgency(estateId, report.id);
  const conflict =
    mutation.error instanceof ReportRequestError &&
    mutation.error.status === 409;
  const pending = mutation.isPending || reloading;
  const chooseUrgency = useCallback((value: string | null) => {
    if (
      value === "LOW" ||
      value === "MEDIUM" ||
      value === "HIGH" ||
      value === "URGENT"
    ) {
      setUrgency(value);
    }
  }, []);
  const chooseSafety = useCallback((checked: boolean) => {
    setSafety(checked);
    if (checked) {
      setUrgency("URGENT");
    }
  }, []);
  const save = useCallback(async () => {
    if (saving.current || pending || conflict) {
      return;
    }
    saving.current = true;
    try {
      await mutation.mutateAsync({
        urgency,
        isSafety,
        expectedVersion: observed.urgencyVersion,
      });
      close();
    } catch {
      // Keep the draft and let the mutation's visible error explain the failure.
    } finally {
      saving.current = false;
    }
  }, [
    close,
    conflict,
    isSafety,
    mutation,
    observed.urgencyVersion,
    pending,
    urgency,
  ]);
  const reloadCurrent = useCallback(async () => {
    setReloading(true);
    setReloadError(undefined);
    try {
      const current = await reload();
      if (!current) {
        throw new Error("Report unavailable.");
      }
      setObserved(current);
      setUrgency(current.urgency);
      setSafety(current.isSafety);
      mutation.reset();
    } catch {
      setReloadError("Couldn't reload urgency. Try again.");
    } finally {
      setReloading(false);
    }
  }, [mutation, reload]);
  return (
    <FormDialog
      description="Set the urgency for this report. Safety reports are always Urgent."
      onClose={close}
      onSubmit={save}
      open
      pending={pending}
      secondaryActions={
        conflict ? (
          <Button
            disabled={pending}
            onClick={reloadCurrent}
            type="button"
            variant="outline"
          >
            Reload
          </Button>
        ) : null
      }
      submitDisabled={conflict}
      submitLabel="Save urgency"
      title="Change urgency"
    >
      <Field>
        <FieldLabel htmlFor={`${id}-urgency`}>Urgency</FieldLabel>
        <Select
          disabled={pending || isSafety}
          onValueChange={chooseUrgency}
          value={urgency}
        >
          <SelectTrigger className="w-full" id={`${id}-urgency`}>
            <SelectValue>{urgencyLabels[urgency]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="LOW">{urgencyLabels.LOW}</SelectItem>
            <SelectItem value="MEDIUM">{urgencyLabels.MEDIUM}</SelectItem>
            <SelectItem value="HIGH">{urgencyLabels.HIGH}</SelectItem>
            <SelectItem value="URGENT">{urgencyLabels.URGENT}</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field orientation="horizontal">
        <Checkbox
          checked={isSafety}
          disabled={pending}
          id={`${id}-safety`}
          onCheckedChange={chooseSafety}
        />
        <FieldLabel htmlFor={`${id}-safety`}>Safety report</FieldLabel>
      </Field>
      {mutation.error ? (
        <Alert role="alert" variant="destructive">
          <AlertDescription>{mutation.error.message}</AlertDescription>
        </Alert>
      ) : null}
      {reloadError ? <p role="alert">{reloadError}</p> : null}
    </FormDialog>
  );
}
