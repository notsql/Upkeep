import { Alert, AlertDescription, AlertTitle } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import { Label } from "@proj/ui/components/label";
import { Textarea } from "@proj/ui/components/textarea";
import { useId } from "react";
import type { AssociationDialogState } from "./use-document-work-order-dialog";
import { WorkOrderPicker } from "./work-order-picker";

export function AssociationEditor({
  estateId,
  state,
}: {
  estateId: string;
  state: AssociationDialogState;
}) {
  const reasonId = useId();
  const {
    latest,
    editing,
    removing,
    correction,
    draft,
    mutation,
    select,
    save,
    cancel,
    changeReason,
    saveDisabled,
  } = state;
  let saveLabel = removing ? "Confirm removal" : "Save link";
  if (mutation.isPending) {
    saveLabel = "Saving…";
  }
  if (!editing) {
    return null;
  }
  return (
    <>
      {removing ? (
        <Alert>
          <AlertTitle>Remove work-order link</AlertTitle>
          <AlertDescription>
            Remove the link to {latest?.workOrderReference}? The uploaded
            document will remain available.
          </AlertDescription>
        </Alert>
      ) : (
        <WorkOrderPicker estateId={estateId} onSelect={select} />
      )}
      {draft?.selected ? (
        <p role="status">Selected: {draft.selected.reference}</p>
      ) : null}
      <form className="space-y-3" onSubmit={save}>
        {correction || removing ? (
          <div className="space-y-2">
            <Label htmlFor={reasonId}>Correction reason</Label>
            <Textarea
              id={reasonId}
              maxLength={500}
              onChange={changeReason}
              required
              value={draft?.reason ?? ""}
            />
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button disabled={saveDisabled} type="submit">
            {saveLabel}
          </Button>
          {draft ? (
            <Button
              disabled={mutation.isPending}
              onClick={cancel}
              type="button"
              variant="outline"
            >
              Cancel changes
            </Button>
          ) : null}
        </div>
      </form>
    </>
  );
}
