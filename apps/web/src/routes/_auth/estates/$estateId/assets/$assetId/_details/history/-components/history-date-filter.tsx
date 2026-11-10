import { Button } from "@proj/ui/components/button";
import { type FormEvent, useCallback, useId, useState } from "react";
import { DatePicker } from "@/components/forms/date-picker";
import {
  type HistoryDateFilters,
  validateHistoryDates,
} from "@/lib/asset-history";

export function HistoryDateFilter({
  filters,
  onApply,
}: {
  filters: HistoryDateFilters;
  onApply: (filters: HistoryDateFilters) => void;
}) {
  const id = useId();
  const [from, setFrom] = useState(filters.from ?? "");
  const [to, setTo] = useState(filters.to ?? "");
  const [error, setError] = useState<string>();
  const apply = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      try {
        const dates = validateHistoryDates({
          from: from || undefined,
          to: to || undefined,
        });
        setError(undefined);
        onApply(dates);
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Choose a valid date range."
        );
      }
    },
    [from, to, onApply]
  );
  const clear = useCallback(() => {
    setFrom("");
    setTo("");
    setError(undefined);
    onApply({});
  }, [onApply]);
  const description = `${id}-help${error ? ` ${id}-error` : ""}`;
  return (
    <form
      aria-label="Filter history by date"
      className="w-full space-y-4"
      onSubmit={apply}
    >
      <p className="text-muted-foreground text-sm" id={`${id}-help`}>
        Dates include both selected days in Singapore time. Leave a date blank
        for an open range.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 xl:flex xl:items-end">
        <div className="min-w-0 space-y-2 xl:flex-1">
          <label htmlFor={`${id}-from`}>From date</label>
          <DatePicker
            aria-describedby={description}
            aria-invalid={!!error}
            id={`${id}-from`}
            onChange={setFrom}
            value={from}
          />
        </div>
        <div className="min-w-0 space-y-2 xl:flex-1">
          <label htmlFor={`${id}-to`}>To date</label>
          <DatePicker
            aria-describedby={description}
            aria-invalid={!!error}
            id={`${id}-to`}
            onChange={setTo}
            value={to}
          />
        </div>
        <Button type="submit">Apply dates</Button>
        <Button onClick={clear} type="button" variant="outline">
          Clear dates
        </Button>
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
