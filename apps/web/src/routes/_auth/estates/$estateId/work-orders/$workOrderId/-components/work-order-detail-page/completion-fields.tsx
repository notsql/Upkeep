import { Field, FieldLabel } from "@proj/ui/components/field";
import { Input } from "@proj/ui/components/input";
import { Textarea } from "@proj/ui/components/textarea";
import type { WorkOrder } from "@/lib/work-orders";

export function CompletionFields({
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
