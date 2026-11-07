import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@proj/ui/components/combobox";
import { Label } from "@proj/ui/components/label";
import { useCallback } from "react";

export function LevelPositionFilter({
  errorId,
  id,
  label,
  onChange,
  placeholder,
  positions,
  value,
}: {
  errorId?: string;
  id: string;
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  positions: string[];
  value: string;
}) {
  const select = useCallback(
    (position: string | null) => {
      if (position !== null) {
        onChange(position);
      }
    },
    [onChange]
  );

  return (
    <div className="space-y-2 sm:w-48">
      <Label htmlFor={id}>{label}</Label>
      <Combobox
        defaultValue={value}
        inputValue={value}
        items={positions}
        onInputValueChange={onChange}
        onValueChange={select}
      >
        <ComboboxInput
          aria-describedby={errorId}
          aria-invalid={!!errorId}
          className="w-full"
          id={id}
          placeholder={placeholder}
        />
        <ComboboxContent className="rounded-xl">
          <ComboboxEmpty>
            No positions found. Type a whole number.
          </ComboboxEmpty>
          <ComboboxList>
            {(position: string) => (
              <ComboboxItem key={position} value={position}>
                {position || placeholder}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
}
