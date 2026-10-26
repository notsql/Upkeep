import { Field, FieldLabel } from "@proj/ui/components/field";
import { Input } from "@proj/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";
import { Textarea } from "@proj/ui/components/textarea";
import type { ChangeEvent } from "react";
import type { InspectionAsset, InspectionInput } from "@/lib/inspections";

const OUTCOMES = [
  { value: "PASS", label: "Pass" },
  { value: "FAIL", label: "Fail" },
];

export function InspectionFields({
  outcome,
  date,
  notes,
  installedOn,
  onOutcomeChange,
  onDateChange,
  onNotesChange,
}: {
  outcome: InspectionInput["outcome"] | "";
  date: string;
  notes: string;
  installedOn: InspectionAsset["installedOn"];
  onOutcomeChange: (value: string | null) => void;
  onDateChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onNotesChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
}) {
  return (
    <>
      <Field>
        <FieldLabel htmlFor="inspection-outcome">Outcome</FieldLabel>
        <Select
          items={OUTCOMES}
          onValueChange={onOutcomeChange}
          required
          value={outcome || null}
        >
          <SelectTrigger id="inspection-outcome">
            <SelectValue placeholder="Choose Pass or Fail" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PASS">Pass</SelectItem>
            <SelectItem value="FAIL">Fail</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor="inspection-date">Inspection date</FieldLabel>
        <Input
          id="inspection-date"
          max={new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Singapore",
          }).format(new Date())}
          min={installedOn ?? undefined}
          onChange={onDateChange}
          required
          type="date"
          value={date}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="inspection-notes">Notes (optional)</FieldLabel>
        <Textarea
          id="inspection-notes"
          maxLength={2000}
          onChange={onNotesChange}
          value={notes}
        />
      </Field>
    </>
  );
}
