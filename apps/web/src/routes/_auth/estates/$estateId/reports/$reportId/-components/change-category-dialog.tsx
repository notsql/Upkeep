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
import { RadioGroup, RadioGroupItem } from "@proj/ui/components/radio-group";
import { useCallback, useId, useState } from "react";
import {
  FAULT_CATEGORIES,
  type FaultCategory,
  useChangeCategory,
} from "@/lib/report-routing";

/** Lets a manager put the report under another type of problem. Nothing is sent by this alone. */
export function ChangeCategoryDialog({
  estateId,
  reportId,
  current,
}: {
  estateId: string;
  reportId: string;
  current: FaultCategory | null;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<FaultCategory | null>(current);
  const change = useChangeCategory(estateId, reportId);
  const openChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (next) {
        setChosen(current);
        change.reset();
      }
    },
    [change.reset, current]
  );
  const choose = useCallback(
    (value: unknown) => setChosen(value as FaultCategory),
    []
  );
  const save = useCallback(() => {
    if (chosen) {
      change.mutate(chosen, { onSuccess: () => setOpen(false) });
    }
  }, [change, chosen]);
  return (
    <Dialog onOpenChange={openChange} open={open}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        Change type
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change type</DialogTitle>
          <DialogDescription>
            What kind of problem is this? Changing it doesn't send anything to a
            contractor.
          </DialogDescription>
        </DialogHeader>
        <RadioGroup
          aria-label="Type of problem"
          disabled={change.isPending}
          onValueChange={choose}
          value={chosen}
        >
          {FAULT_CATEGORIES.map((item) => (
            <div className="flex items-center gap-2" key={item.value}>
              <RadioGroupItem
                aria-labelledby={`${id}-${item.value}`}
                value={item.value}
              />
              <span className="text-sm" id={`${id}-${item.value}`}>
                {item.label}
              </span>
            </div>
          ))}
        </RadioGroup>
        {change.isError ? (
          <Alert role="alert" variant="destructive">
            <AlertDescription>{change.error.message}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button
            disabled={!chosen || chosen === current || change.isPending}
            onClick={save}
          >
            Save type
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
