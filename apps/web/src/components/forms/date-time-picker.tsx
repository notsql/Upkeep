import { useCallback } from "react";
import {
  DatePicker,
  type DateTriggerProps,
  toDateValue,
} from "@/components/forms/date-picker";
import { TimePicker } from "@/components/forms/time-picker";

/**
 * A DatePicker plus a TimePicker (shadcn Selects, not the browser widget). Value and onChange use the native
 * `datetime-local` string, `YYYY-MM-DDTHH:mm` ("" when empty). The date
 * trigger keeps room for "Pick a date" and the time sits beside it, wrapping
 * underneath rather than squeezing the date when the container is narrow.
 */
export function DateTimePicker({
  value,
  onChange,
  placeholder,
  className,
  ...trigger
}: DateTriggerProps & {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [date = "", time = ""] = value ? value.split("T") : [];
  const timeLabel = trigger["aria-label"]
    ? `${trigger["aria-label"]} time`
    : "Time";

  const dateChange = useCallback(
    (next: string) => onChange(next ? `${next}T${time || "00:00"}` : ""),
    [onChange, time]
  );
  const timeChange = useCallback(
    (next: string) => {
      onChange(next ? `${date || toDateValue(new Date())}T${next}` : "");
    },
    [onChange, date]
  );

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className ?? ""}`}>
      <DatePicker
        className="min-w-36 flex-1"
        onChange={dateChange}
        placeholder={placeholder}
        value={date}
        {...trigger}
      />
      <TimePicker
        aria-describedby={trigger["aria-describedby"]}
        aria-invalid={trigger["aria-invalid"]}
        aria-label={timeLabel}
        className="shrink-0"
        disabled={trigger.disabled}
        id={trigger.id ? `${trigger.id}-time` : undefined}
        onChange={timeChange}
        partLabel={trigger["aria-label"] ?? "Time"}
        value={time.slice(0, 5)}
      />
    </div>
  );
}
