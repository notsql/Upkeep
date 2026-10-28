import { type FormEvent, useCallback, useRef, useState } from "react";
import {
  type ManualReadingFields,
  manualReadingError,
} from "@/lib/manual-reading-form";
import {
  type ManualReading,
  type ReadingAsset,
  type ReadingMetricOption,
  useCreateManualReading,
} from "@/lib/readings";

export function useManualReadingSubmission(
  estateId: string,
  fields: ManualReadingFields,
  selectedMetric: ReadingMetricOption | undefined,
  asset: ReadingAsset | undefined,
  onSaved: (reading: ManualReading) => void
) {
  const mutation = useCreateManualReading(estateId);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const submission = useRef<{ fingerprint: string; id: string } | null>(null);
  const clearError = useCallback(() => setError(undefined), []);
  const submit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (mutation.isPending || saved) {
        return;
      }
      const validation = manualReadingError(fields);
      if (validation) {
        setError(validation);
        return;
      }
      if (!selectedMetric) {
        setError("Choose a supported metric.");
        return;
      }
      if (asset?.retired) {
        setError("This asset is retired. Choose an active asset.");
        return;
      }
      const payload = {
        assetId: fields.assetId as string,
        metric: selectedMetric.metric,
        value: Number(fields.value),
        unit: selectedMetric.unit,
        measuredAt: new Date(fields.measuredAt).toISOString(),
      };
      const fingerprint = JSON.stringify(payload);
      if (submission.current?.fingerprint !== fingerprint) {
        submission.current = { fingerprint, id: crypto.randomUUID() };
      }
      try {
        const reading = await mutation.mutateAsync({
          ...payload,
          submissionId: submission.current.id,
        });
        setSaved(true);
        onSaved(reading);
      } catch {
        /* The mutation error is shown below; fields and submission identity remain available for retry. */
      }
    },
    [fields, selectedMetric, asset, mutation, saved, onSaved]
  );
  return { mutation, error, saved, submit, clearError };
}
