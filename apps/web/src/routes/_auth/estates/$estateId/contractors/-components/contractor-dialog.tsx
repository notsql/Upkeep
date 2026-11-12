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
import { Input } from "@proj/ui/components/input";
import { Label } from "@proj/ui/components/label";
import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useId,
  useState,
} from "react";
import { type Contractor, useSaveContractor } from "@/lib/contractors";

/** Adds a contractor, or edits the one given. */
export function ContractorDialog({
  estateId,
  contractor,
}: {
  estateId: string;
  contractor?: Contractor;
}) {
  const nameId = useId();
  const emailId = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(contractor?.name ?? "");
  const [email, setEmail] = useState(contractor?.email ?? "");
  const save = useSaveContractor(estateId, contractor?.id);
  const submit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      save.mutate(
        { name, email },
        {
          onSuccess: () => {
            setOpen(false);
            if (!contractor) {
              setName("");
              setEmail("");
            }
          },
        }
      );
    },
    [contractor, email, name, save]
  );
  const changeName = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setName(event.target.value),
    []
  );
  const changeEmail = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setEmail(event.target.value),
    []
  );
  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger
        render={
          contractor ? (
            <Button
              aria-label={`Edit ${contractor.name}`}
              size="sm"
              variant="outline"
            />
          ) : (
            <Button />
          )
        }
      >
        {contractor ? "Edit" : "Add contractor"}
      </DialogTrigger>
      <DialogContent>
        <form className="grid gap-4" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>
              {contractor ? "Edit contractor" : "Add contractor"}
            </DialogTitle>
            <DialogDescription>
              We email contractors the details of each job you give them.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={nameId}>Name</Label>
            <Input
              autoComplete="organization"
              id={nameId}
              maxLength={200}
              onChange={changeName}
              value={name}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={emailId}>Email</Label>
            <Input
              autoComplete="email"
              id={emailId}
              inputMode="email"
              maxLength={254}
              onChange={changeEmail}
              type="text"
              value={email}
            />
          </div>
          {save.isError ? (
            <Alert role="alert" variant="destructive">
              <AlertDescription>{save.error.message}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button disabled={save.isPending} type="submit">
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
