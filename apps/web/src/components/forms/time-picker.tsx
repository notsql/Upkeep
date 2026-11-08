import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";
import { Clock } from "lucide-react";
import { useCallback } from "react";

const pad = (n: number): string => String(n).padStart(2, "0");
const HOURS = Array.from({ length: 24 }, (_, h) => pad(h));

/**
 * A time field built from two shadcn Selects (hour, minute) instead of the
 * browser's time widget. Value and onChange use `HH:mm` ("" when empty), the
 * same string `<input type="time">` does. Minutes step by `minuteStep`; a
 * value off the step (e.g. 07:32) stays selectable.
 */
export function TimePicker({
  value,
  onChange,
  minuteStep = 5,
  className,
  disabled,
  id,
  "aria-label": ariaLabel = "Time",
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  partLabel = ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  minuteStep?: number;
  className?: string;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  /** Prefix for the "<prefix> hour" / "<prefix> minute" names; defaults to aria-label. */
  partLabel?: string;
}) {
  const [hour = "", minute = ""] = value ? value.slice(0, 5).split(":") : [];
  const minutes = Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) =>
    pad(i * minuteStep)
  );
  if (minute && !minutes.includes(minute)) {
    minutes.push(minute);
    minutes.sort();
  }

  const hourChange = useCallback(
    (next: string | null) => {
      if (next) {
        onChange(`${next}:${minute || "00"}`);
      }
    },
    [onChange, minute]
  );
  const minuteChange = useCallback(
    (next: string | null) => {
      if (next) {
        onChange(`${hour || "00"}:${next}`);
      }
    },
    [onChange, hour]
  );

  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset would add a border and legend; this is one compound control.
    <div
      aria-label={ariaLabel}
      className={`flex shrink-0 items-center gap-1 ${className ?? ""}`}
      role="group"
    >
      <Clock aria-hidden="true" className="text-muted-foreground size-4" />
      <Select
        disabled={disabled}
        onValueChange={hourChange}
        value={hour || null}
      >
        <SelectTrigger
          aria-describedby={describedBy}
          aria-invalid={invalid}
          aria-label={`${partLabel} hour`}
          className="w-20"
          id={id}
        >
          <SelectValue placeholder="HH" />
        </SelectTrigger>
        <SelectContent>
          {HOURS.map((h) => (
            <SelectItem key={h} value={h}>
              {h}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span aria-hidden="true">:</span>
      <Select
        disabled={disabled}
        onValueChange={minuteChange}
        value={minute || null}
      >
        <SelectTrigger
          aria-describedby={describedBy}
          aria-invalid={invalid}
          aria-label={`${partLabel} minute`}
          className="w-20"
          id={id ? `${id}-minute` : undefined}
        >
          <SelectValue placeholder="mm" />
        </SelectTrigger>
        <SelectContent>
          {minutes.map((m) => (
            <SelectItem key={m} value={m}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
