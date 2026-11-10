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
import { Input } from "@proj/ui/components/input";
import { Label } from "@proj/ui/components/label";
import { type FormEvent, useCallback, useId, useState } from "react";
import {
  type Contractor,
  useRemoveContractor,
  useSaveContractor,
} from "@/lib/contractors";
import type { EquipmentType } from "@/lib/report-routing";

export function ContractorRow({
  estateId,
  type,
  label,
  contractor,
}: {
  estateId: string;
  type: EquipmentType;
  label: string;
  contractor: Contractor | undefined;
}) {
  const nameId = useId();
  const emailId = useId();
  const [name, setName] = useState(contractor?.name ?? "");
  const [email, setEmail] = useState(contractor?.email ?? "");
  const [confirming, setConfirming] = useState(false);
  const save = useSaveContractor(estateId, type);
  const remove = useRemoveContractor(estateId, type);
  const lower = label.toLowerCase();
  const submit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      save.mutate({ name, email });
    },
    [email, name, save]
  );
  const confirmRemove = useCallback(
    () => remove.mutate(undefined, { onSuccess: () => setConfirming(false) }),
    [remove]
  );
  const changeName = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => setName(event.target.value),
    []
  );
  const changeEmail = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) =>
      setEmail(event.target.value),
    []
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="font-semibold">{label}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
          <div className="grid gap-2">
            <Label htmlFor={nameId}>{label} contractor name</Label>
            <Input
              autoComplete="organization"
              id={nameId}
              maxLength={200}
              onChange={changeName}
              value={name}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={emailId}>{label} contractor email</Label>
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
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <Button disabled={save.isPending} type="submit">
              Save {lower} contractor
            </Button>
            {contractor ? (
              <Dialog onOpenChange={setConfirming} open={confirming}>
                <DialogTrigger render={<Button variant="outline" />}>
                  Remove {lower} contractor
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Remove {lower} contractor?</DialogTitle>
                    <DialogDescription>
                      {contractor.name} will no longer receive {lower} work
                      orders. Work orders already created are unchanged.
                    </DialogDescription>
                  </DialogHeader>
                  {remove.isError ? (
                    <Alert role="alert" variant="destructive">
                      <AlertDescription>
                        {remove.error.message}
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  <DialogFooter>
                    <Button
                      disabled={remove.isPending}
                      onClick={confirmRemove}
                      variant="destructive"
                    >
                      Remove
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ) : null}
            {save.isSuccess ? (
              <p role="status">{label} contractor saved.</p>
            ) : null}
          </div>
          {save.isError ? (
            <Alert className="sm:col-span-2" role="alert" variant="destructive">
              <AlertDescription>{save.error.message}</AlertDescription>
            </Alert>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
