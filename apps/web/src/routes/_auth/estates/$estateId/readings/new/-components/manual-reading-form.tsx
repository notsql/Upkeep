import { Alert, AlertDescription, AlertTitle } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { PageHeader } from "@/components/page-header";
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
import { ManualMeasurementFields } from "./manual-measurement-fields";
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

export function ManualReadingForm({
  estateId,
  initialAssetId,
  initialMetric,
  onSaved,
}: {
  estateId: string;
  initialAssetId?: string;
  initialMetric?: string;
  onSaved: (reading: ManualReading) => void;
}) {
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
  if (access.data && !estate?.canRecordReadings) {
    return (
      <Alert>
        <AlertDescription>
          Manual reading entry is not available for this estate.
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <main className="page-layout min-w-0 space-y-6 [overflow-wrap:anywhere]">
      <PageHeader
        breadcrumbs={[
          { label: "Estates", to: "/estates" },
          {
            label: estate?.estateName ?? "Estate",
            to: "/estates/$estateId",
            params: { estateId },
          },
          {
            label: "Readings",
            to: "/estates/$estateId/readings",
            params: { estateId },
          },
          { label: "Record manual reading" },
        ]}
        description={estate?.estateName}
        title="Record manual reading"
      />
      {metrics.error || assets.error ? (
        <Alert variant="destructive">
          <AlertDescription>
            {metrics.error?.message ?? assets.error?.message}
            <Button onClick={retry} variant="outline">
              Retry form options
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {metrics.isPending ? <p role="status">Loading metrics…</p> : null}
      {metrics.data ? (
        <form
          aria-label="Manual reading"
          className="section-surface max-w-3xl space-y-6"
          onSubmit={submit}
        >
          <fieldset
            className="min-w-0 space-y-5"
            disabled={mutation.isPending || saved}
          >
            <ManualMeasurementFields
              assetLabel={label}
              estateId={estateId}
              fields={fields}
              metrics={metrics.data}
              onChange={change}
              onChoose={choose}
              selectedMetric={selectedMetric}
            />
          </fieldset>
          {outside ? (
            <Alert>
              <AlertTitle>Check this measurement</AlertTitle>
              <AlertDescription>
                Outside the expected range. You can still save this measurement;
                it will be flagged for review.
              </AlertDescription>
            </Alert>
          ) : null}
          {saveError ? (
            <Alert variant="destructive">
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Button disabled={mutation.isPending || saved} type="submit">
              {mutation.isPending ? "Saving reading…" : "Save manual reading"}
            </Button>
            <Button
              disabled={mutation.isPending}
              render={
                <Link
                  params={{ estateId }}
                  search={{ assetId: fields.assetId }}
                  to="/estates/$estateId/readings"
                />
              }
              variant="outline"
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </main>
  );
}
