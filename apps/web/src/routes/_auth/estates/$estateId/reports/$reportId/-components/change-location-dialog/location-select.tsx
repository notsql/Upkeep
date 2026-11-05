import { Label } from "@proj/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";
import { useId } from "react";

export function LocationSelect({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  options: { id: string; name: string }[];
  value: string | null;
  onChange: (value: string | null) => void;
  disabled: boolean;
}) {
  const id = useId();
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        disabled={disabled}
        items={options.map((option) => ({
          value: option.id,
          label: option.name,
        }))}
        onValueChange={onChange}
        value={value}
      >
        <SelectTrigger className="w-full" id={id}>
          <SelectValue placeholder={`Choose ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
