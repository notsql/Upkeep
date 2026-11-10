import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@proj/ui/components/dialog";
import { Field, FieldDescription, FieldLabel } from "@proj/ui/components/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";
import { type FormEvent, useCallback, useId, useState } from "react";
import { toast } from "sonner";
import {
  DispatchError,
  type Inspector,
  useInspectors,
  useSendCrew,
} from "@/lib/equipment-dispatch";

function label(person: Inspector): string {
  return `${person.name} · ${person.roleName}`;
}

/** Picks one person who can record inspections and sends them. */
export function SendCrewDialog({
  assetId,
  assetName,
  estateId,
  onOpenChange,
  open,
}: {
  assetId: string;
  assetName: string;
  estateId: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const id = useId();
  const inspectors = useInspectors(estateId, open);
  const send = useSendCrew(estateId, assetId);
  const [person, setPerson] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const people = inspectors.data ?? [];
  const options = people.map((item) => ({
    value: item.userId,
    label: label(item),
  }));
  const noCrew =
    inspectors.isSuccess && !people.some((item) => item.roleName === "Crew");
  const { mutateAsync, isPending } = send;
  const { refetch } = inspectors;
  const close = useCallback(
    (next: boolean) => {
      if (!isPending) {
        onOpenChange(next);
      }
    },
    [isPending, onOpenChange]
  );
  const cancel = useCallback(() => close(false), [close]);
  const submit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!person || isPending) {
        return;
      }
      setError(undefined);
      const chosen = people.find((item) => item.userId === person);
      const name = chosen?.name ?? "them";
      try {
        const { check, created } = await mutateAsync(person);
        onOpenChange(false);
        if (created) {
          toast.success(`Sent to ${name} to inspect ${assetName}.`);
        } else {
          toast.success(
            `Already sent to ${check.assignedToName ?? "someone else"}.`
          );
        }
      } catch (cause) {
        if (cause instanceof DispatchError && cause.status === 400) {
          setError(
            `${name} can no longer record inspections here. Choose someone else.`
          );
          setPerson(null);
          refetch();
          return;
        }
        setError(
          cause instanceof Error
            ? cause.message
            : "Couldn't send crew. Try again."
        );
      }
    },
    [person, isPending, people, mutateAsync, onOpenChange, assetName, refetch]
  );
  return (
    <Dialog onOpenChange={close} open={open}>
      <DialogContent className="sm:max-w-md" showCloseButton={!isPending}>
        <form className="grid gap-4" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Who should inspect {assetName}?</DialogTitle>
            <DialogDescription>
              They will be asked to inspect it today.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor={id}>Person</FieldLabel>
            {inspectors.isPending ? (
              <p className="text-muted-foreground text-sm">Loading people…</p>
            ) : null}
            {inspectors.isSuccess ? (
              <Select
                items={options}
                onValueChange={setPerson}
                required
                value={person}
              >
                <SelectTrigger className="w-full" id={id}>
                  <SelectValue placeholder="Choose a person" />
                </SelectTrigger>
                <SelectContent>
                  {options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            {noCrew ? (
              <FieldDescription>
                No crew in this estate yet. Invite crew in People & access.
              </FieldDescription>
            ) : null}
          </Field>
          {inspectors.error ? (
            <Alert variant="destructive">
              <AlertDescription>{inspectors.error.message}</AlertDescription>
            </Alert>
          ) : null}
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button
              disabled={isPending}
              onClick={cancel}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={!person || isPending} type="submit">
              {isPending ? "Sending…" : "Send"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
