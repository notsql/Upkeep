import { Field, FieldLabel } from "@proj/ui/components/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";
import { useCallback } from "react";
import type { ReportEstate } from "@/lib/reports";

/**
 * Pick the estate to report in. Only the estates the user belongs to are
 * offered: reporting needs a membership (estate-role-permissions).
 */
export function ResidentEstateSelector({
  estates,
  estate,
  onChange,
  id,
}: {
  estates: ReportEstate[];
  estate?: ReportEstate;
  onChange: (estate: ReportEstate | null) => void;
  id: string;
}) {
  const select = useCallback(
    (value: string | null) => {
      onChange(estates.find((item) => item.id === value) ?? null);
    },
    [estates, onChange]
  );
  const inputId = `${id}-estate`;
  return (
    <Field>
      <FieldLabel htmlFor={inputId}>Estate</FieldLabel>
      <Select
        items={estates.map((item) => ({ value: item.id, label: item.name }))}
        onValueChange={select}
        value={estate?.id ?? null}
      >
        <SelectTrigger className="w-full" id={inputId}>
          <SelectValue placeholder="Choose your estate" />
        </SelectTrigger>
        <SelectContent>
          {estates.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {item.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
