import {
  type ChangeEvent,
  type SubmitEvent,
  useCallback,
  useMemo,
  useState,
} from "react";
import type { Location } from "@/lib/locations";
import {
  type AddFloorsResult,
  checkRange,
} from "@/routes/_auth/estates/$estateId/-components/locations-section/add-floors-form/add-floors-range";

export function useAddFloorsForm(
  existingLevels: Location[],
  onSave: (
    lowestFloor: number,
    highestFloor: number
  ) => Promise<AddFloorsResult>,
  onPendingChange?: (pending: boolean) => void
) {
  const [lowest, setLowest] = useState("");
  const [highest, setHighest] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<AddFloorsResult>();
  const range = useMemo(
    () => checkRange(lowest, highest, existingLevels),
    [lowest, highest, existingLevels]
  );
  const bothEntered = lowest.trim() !== "" && highest.trim() !== "";

  const changeLowest = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setLowest(event.target.value),
    []
  );
  const changeHighest = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setHighest(event.target.value),
    []
  );

  const handleSubmit = useCallback(
    async (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      setSubmitted(true);
      if (pending || !range.ok) {
        return;
      }
      const floors = range.floors.map((floor) => floor.floor);
      setPending(true);
      onPendingChange?.(true);
      setError(undefined);
      try {
        setResult(await onSave(Math.min(...floors), Math.max(...floors)));
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Couldn't add the floors. Try again."
        );
      } finally {
        setPending(false);
        onPendingChange?.(false);
      }
    },
    [onSave, pending, range, onPendingChange]
  );

  return {
    bothEntered,
    changeHighest,
    changeLowest,
    error,
    handleSubmit,
    highest,
    lowest,
    pending,
    range,
    result,
    submitted,
  };
}
