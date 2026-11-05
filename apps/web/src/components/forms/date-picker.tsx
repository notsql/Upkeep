import { Button } from "@proj/ui/components/button";
import { Calendar } from "@proj/ui/components/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@proj/ui/components/popover";
import { CalendarIcon } from "lucide-react";
import { useCallback, useState } from "react";

const DATE_VALUE = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/u;

/** `YYYY-MM-DD` (the native date input's value) to a local Date. */
export function parseDateValue(value: string | undefined): Date | undefined {
  const groups = DATE_VALUE.exec(value ?? "")?.groups;
  if (!groups) {
    return;
  }
  return new Date(
    Number(groups.year),
    Number(groups.month) - 1,
    Number(groups.day)
  );
}

/** A local Date to `YYYY-MM-DD`. */
export function toDateValue(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

const displayFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatDateValue(value: string | undefined): string | null {
  const date = parseDateValue(value);
  return date ? displayFormat.format(date) : null;
}

export interface DateTriggerProps {
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-label"?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}

/**
 * A shadcn Popover + Calendar date field. Value and onChange use the same
 * `YYYY-MM-DD` string a native `<input type="date">` does ("" when empty),
 * so it drops into existing form state unchanged.
 */
export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  clearable = true,
  min,
  max,
  className = "w-full",
  ...trigger
}: DateTriggerProps & {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  clearable?: boolean;
  min?: string;
  max?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseDateValue(value);
  const label = formatDateValue(value);
  const fromDate = parseDateValue(min);
  const toDate = parseDateValue(max);
  const disabledDays = [
    ...(fromDate ? [{ before: fromDate }] : []),
    ...(toDate ? [{ after: toDate }] : []),
  ];

  const select = useCallback(
    (date: Date | undefined) => {
      onChange(date ? toDateValue(date) : "");
      setOpen(false);
    },
    [onChange]
  );
  const clear = useCallback(() => select(undefined), [select]);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        render={
          <Button
            className={`justify-start font-normal ${className}`}
            variant="outline"
            {...trigger}
          />
        }
      >
        <CalendarIcon aria-hidden="true" />
        <span className={label ? undefined : "text-muted-foreground"}>
          {label ?? placeholder}
        </span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          captionLayout="dropdown"
          defaultMonth={selected}
          disabled={disabledDays}
          mode="single"
          onSelect={select}
          selected={selected}
        />
        {clearable && selected ? (
          <div className="border-t p-2">
            <Button
              className="w-full"
              onClick={clear}
              size="sm"
              variant="ghost"
            >
              Clear date
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
