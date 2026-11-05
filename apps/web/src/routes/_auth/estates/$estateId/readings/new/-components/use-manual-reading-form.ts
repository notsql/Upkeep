import { useCallback, useState } from "react";
import { useAppAccess } from "@/lib/access";
import {
  currentLocalMeasurementTime,
  type ManualReadingFields,
} from "@/lib/manual-reading-form";
import {
  type ManualReading,
  type ReadingAsset,
  type ReadingMetricOption,
  useReadingAssets,
  useReadingMetrics,
} from "@/lib/readings";
import { useManualReadingSubmission } from "./use-manual-reading-submission";

function outsideExpectedRange(
  value: string,
  metric: ReadingMetricOption | undefined
): boolean {
  if (!(metric && value.trim())) {
    return false;
  }
  const numeric = Number(value);
  return (
    Number.isFinite(numeric) &&
    (numeric < metric.validMin || numeric > metric.validMax)
  );
}

function selectedAssetLabel(
  asset: ReadingAsset | undefined,
  id: string | undefined
): string {
  if (asset) {
    return `${asset.reference} · ${asset.name}${asset.retired ? " · Retired" : ""}`;
  }
  return id ? "Selected asset" : "Choose an asset";
}

export function useManualReadingForm(
  estateId: string,
  initialAssetId: string | undefined,
  initialMetric: string | undefined,
  onSaved: (reading: ManualReading) => void
) {
  const access = useAppAccess();
  const estate = access.data?.estates.find(
    (item) => item.estateId === estateId
  );
  const assets = useReadingAssets(estateId);
  const metrics = useReadingMetrics(estateId);
  const [fields, setFields] = useState<ManualReadingFields>(() => ({
    assetId: initialAssetId,
    metric: initialMetric ?? "",
    value: "",
    measuredAt: currentLocalMeasurementTime(),
  }));
  const [chosen, setChosen] = useState<ReadingAsset>();
  const selectedMetric = metrics.data?.find(
    (option) => option.metric === fields.metric
  );
  const asset =
    chosen?.id === fields.assetId
      ? chosen
      : assets.data?.items.find((option) => option.id === fields.assetId);
  const label = selectedAssetLabel(asset, fields.assetId);
  const { mutation, error, saved, submit, clearError } =
    useManualReadingSubmission(
      estateId,
      fields,
      selectedMetric,
      asset,
      onSaved
    );
  const change = useCallback(
    (next: Partial<ManualReadingFields>) => {
      setFields((current) => ({ ...current, ...next }));
      clearError();
    },
    [clearError]
  );
  const choose = useCallback(
    (selected: ReadingAsset | undefined) => {
      setChosen(selected);
      change({ assetId: selected?.id });
    },
    [change]
  );
  const retry = useCallback(() => {
    assets.refetch();
    metrics.refetch();
  }, [assets.refetch, metrics.refetch]);
  const outside = outsideExpectedRange(fields.value, selectedMetric);
  const saveError = error || mutation.error?.message;
  return {
    access,
    assets,
    change,
    choose,
    estate,
    fields,
    label,
    metrics,
    mutation,
    outside,
    retry,
    saveError,
    saved,
    selectedMetric,
    submit,
  };
}
