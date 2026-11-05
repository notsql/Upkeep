import { type ChangeEvent, useCallback } from "react";

/**
 * Text-box stand-ins for the shared date pickers, for screen tests that only
 * care what value a screen sends. Swap them in with
 * `vi.mock("@/components/date-picker", () => import("@tests/date-picker-stubs"))`
 * (and the same for `date-time-picker` / `date-range-picker`). They take the
 * pickers' string values, so a `fireEvent.change` with a `YYYY-MM-DD` (or
 * `YYYY-MM-DDTHH:mm`) string stands in for picking from the calendar. The
 * pickers themselves are tested in `tests/components/`.
 */
interface StubProps {
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-label"?: string;
  disabled?: boolean;
  id?: string;
  onChange: (value: string) => void;
  value: string;
}

function TextStub({ onChange, value, ...props }: StubProps) {
  const change = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value),
    [onChange]
  );
  return <input {...props} onChange={change} type="text" value={value} />;
}

export function DatePicker(props: StubProps) {
  return <TextStub {...props} />;
}

export function DateTimePicker(props: StubProps) {
  return <TextStub {...props} />;
}

export function DateRangePicker({
  value,
  onChange,
  id,
  disabled,
}: {
  disabled?: boolean;
  id?: string;
  onChange: (value: { from: string; to: string }) => void;
  value: { from: string; to: string };
}) {
  const changeFrom = useCallback(
    (from: string) => onChange({ ...value, from }),
    [onChange, value]
  );
  const changeTo = useCallback(
    (to: string) => onChange({ ...value, to }),
    [onChange, value]
  );
  return (
    <>
      <TextStub
        aria-label="Start date"
        disabled={disabled}
        id={id}
        onChange={changeFrom}
        value={value.from}
      />
      <TextStub
        aria-label="End date"
        disabled={disabled}
        onChange={changeTo}
        value={value.to}
      />
    </>
  );
}
