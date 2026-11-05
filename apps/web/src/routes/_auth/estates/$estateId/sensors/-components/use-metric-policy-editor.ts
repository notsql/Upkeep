import { type ChangeEvent, useCallback, useState } from "react";
import {
  type SensorPolicy,
  useSetFlatlinePolicy,
} from "@/lib/flatlined-sensors";
import { wholeMinutes } from "@/routes/_auth/estates/$estateId/sensors/-components/sensor-format";

const TOLERANCE = /^\d{1,12}(?:\.\d{1,6})?$/u;

export function useMetricPolicyEditor({
  estateId,
  policy,
  onClose,
  canManage,
}: {
  estateId: string;
  policy: SensorPolicy | undefined;
  onClose: () => void;
  canManage: boolean;
}) {
  const save = useSetFlatlinePolicy(estateId, policy?.metric ?? "TEMPERATURE");
  const [duration, setDuration] = useState("");
  const [unit, setUnit] = useState<"minutes" | "hours">("minutes");
  const [tolerance, setTolerance] = useState("0");
  const [validation, setValidation] = useState<string>();
  const { isPending, mutate, reset } = save;
  const startEditing = useCallback(
    (selectedPolicy: SensorPolicy) => {
      setDuration(selectedPolicy.durationMinutes?.toString() ?? "");
      setUnit("minutes");
      setTolerance(selectedPolicy.tolerance.toString());
      setValidation(undefined);
      reset();
    },
    [reset]
  );
  const handleSubmit = useCallback(() => {
    if (isPending || !canManage || !policy) {
      return;
    }
    setValidation(undefined);
    reset();
    try {
      const durationMinutes = wholeMinutes(duration, unit, 43_200);
      const value = Number(tolerance);
      if (
        !(TOLERANCE.test(tolerance) && Number.isFinite(value)) ||
        value < 0 ||
        value >= 1e12
      ) {
        throw new Error(
          "Tolerance must be non-negative, with at most 12 digits before and 6 after the decimal point."
        );
      }
      mutate(
        { durationMinutes, tolerance: value },
        {
          onSuccess: onClose,
        }
      );
    } catch (error) {
      setValidation(
        error instanceof Error ? error.message : "Check the policy values."
      );
    }
  }, [
    canManage,
    duration,
    isPending,
    mutate,
    onClose,
    policy,
    reset,
    tolerance,
    unit,
  ]);
  const changeDuration = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setDuration(event.target.value),
    []
  );
  const changeUnit = useCallback((value: string | null) => {
    if (value === "minutes" || value === "hours") {
      setUnit(value);
    }
  }, []);
  // The dialog only opens for managers, so losing that right mid-edit means
  // the review failed to load: keep the draft but do not save it.
  const errorMessage =
    validation ||
    save.error?.message ||
    (canManage ? undefined : "Saving is paused until device metrics load");
  const changeTolerance = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setTolerance(event.target.value),
    []
  );
  return {
    duration,
    unit,
    tolerance,
    errorMessage,
    isPending,
    handleSubmit,
    changeDuration,
    changeUnit,
    changeTolerance,
    startEditing,
  };
}
