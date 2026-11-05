import { Field, FieldLabel } from "@proj/ui/components/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";
import { useCallback } from "react";

export function FilterSelect({
  label,
  value,
  options,
  onChange,
  className,
}: {
  className: string;
  label: string;
  value: string;
  options: Record<string, string>;
  onChange: (value: string) => void;
}) {
  const change = useCallback(
    (next: string | null) => onChange(next ?? ""),
    [onChange]
  );
  return (
    <Field className={className}>
      <FieldLabel>{label}</FieldLabel>
      <Select onValueChange={change} value={value}>
        <SelectTrigger aria-label={label} className="w-full">
          <SelectValue>{options[value] ?? "All"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(options).map(([key, text]) => (
            <SelectItem key={key} value={key}>
              {text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
