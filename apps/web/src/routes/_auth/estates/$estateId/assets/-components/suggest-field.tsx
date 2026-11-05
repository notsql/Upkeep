import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@proj/ui/components/combobox";
import { Field, FieldLabel } from "@proj/ui/components/field";
import { useCallback, useState } from "react";

/**
 * A text field that suggests catalogue names as the user types, but accepts
 * any text: an unlisted name is added to the catalogue on save.
 */
export function SuggestField({
  id,
  label,
  name,
  suggestions,
  value,
  onChange,
}: {
  id: string;
  label: string;
  name: string;
  onChange: (value: string) => void;
  suggestions: string[];
  value: string;
}) {
  const [open, setOpen] = useState(false);
  // Typing opens the suggestions; base-ui alone only opens on trusted input.
  const type = useCallback(
    (next: string) => {
      onChange(next);
      setOpen(true);
    },
    [onChange]
  );
  const select = useCallback(
    (next: string | null) => {
      if (next !== null) {
        onChange(next);
      }
      setOpen(false);
    },
    [onChange]
  );
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Combobox
        filter={null}
        inputValue={value}
        items={suggestions}
        onInputValueChange={type}
        onOpenChange={setOpen}
        onValueChange={select}
        open={open && suggestions.length > 0}
        value={value}
      >
        <ComboboxInput
          className="w-full"
          id={id}
          maxLength={200}
          name={name}
          showTrigger={false}
        />
        <ComboboxContent>
          <ComboboxList>
            {(item: string) => (
              <ComboboxItem key={item} value={item}>
                {item}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </Field>
  );
}
