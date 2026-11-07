import { Button } from "@proj/ui/components/button";
import { Calendar } from "@proj/ui/components/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@proj/ui/components/popover";
import { CalendarRange } from "lucide-react";
import { useCallback } from "react";
import {
  type DateTriggerProps,
  formatDateValue,
  parseDateValue,
  toDateValue,
} from "@/components/forms/date-picker";

export interface DateRangeValue {
  from: string;
  to: string;
}

/**
 * A from/to date range in one Popover + two-month Calendar. Both ends are
 * `YYYY-MM-DD` strings ("" when unset).
 */
export function DateRangePicker({
  value,
  onChange,
  placeholder = "Any date",
  className = "w-full",
  ...trigger
}: DateTriggerProps & {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  placeholder?: string;
}) {
  const from = parseDateValue(value.from);
  const to = parseDateValue(value.to);
  const fromLabel = formatDateValue(value.from);
  const toLabel = formatDateValue(value.to);
  const label =
    fromLabel || toLabel
      ? `${fromLabel ?? "Start"} – ${toLabel ?? "End"}`
      : null;

  const select = useCallback(
    (range: { from?: Date; to?: Date } | undefined) =>
      onChange({
        from: range?.from ? toDateValue(range.from) : "",
        to: range?.to ? toDateValue(range.to) : "",
      }),
    [onChange]
  );
  const clear = useCallback(() => onChange({ from: "", to: "" }), [onChange]);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            className={`justify-start font-normal ${className}`}
            variant="outline"
            {...trigger}
          />
        }
      >
        <CalendarRange aria-hidden="true" />
        <span className={label ? undefined : "text-muted-foreground"}>
          {label ?? placeholder}
        </span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          defaultMonth={from ?? to}
          mode="range"
          numberOfMonths={2}
          onSelect={select}
          selected={from || to ? { from, to } : undefined}
        />
        {from || to ? (
          <div className="border-t p-2">
            <Button
              className="w-full"
              onClick={clear}
              size="sm"
              variant="ghost"
            >
              Clear dates
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
