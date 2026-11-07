import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Card, CardContent } from "@proj/ui/components/card";
import { FormPageHeader } from "@/components/page/form-page-header";
import { PageLayout } from "@/components/page/page-layout";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import type { ManualReading } from "@/lib/readings";
import { ManualMeasurementFields } from "@/routes/_auth/estates/$estateId/readings/new/-components/manual-reading-form/manual-measurement-fields";
import { ManualReadingFormAlerts } from "@/routes/_auth/estates/$estateId/readings/new/-components/manual-reading-form/manual-reading-form-alerts";
import { ManualReadingFormFooter } from "@/routes/_auth/estates/$estateId/readings/new/-components/manual-reading-form/manual-reading-form-footer";
import { useManualReadingForm } from "@/routes/_auth/estates/$estateId/readings/new/-components/manual-reading-form/use-manual-reading-form";

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
  const {
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
  } = useManualReadingForm(estateId, initialAssetId, initialMetric, onSaved);
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
    <PageLayout className="min-w-0 space-y-6 [overflow-wrap:anywhere]">
      <FormPageHeader
        breadcrumbs={[
          {
            label: "Readings",
            to: "/estates/$estateId/readings",
            params: { estateId },
          },
          { label: "Record manual reading" },
        ]}
        title="Record manual reading"
      />
      {metrics.error || assets.error ? (
        <ErrorState
          message={
            metrics.error?.message ??
            assets.error?.message ??
            "Unable to load form options"
          }
          onRetry={retry}
          retryLabel="Retry form options"
        />
      ) : null}
      {metrics.isPending ? (
        <LoadingState label="Loading metrics…" rows={2} />
      ) : null}
      {metrics.data ? (
        <Card className="max-w-3xl">
          <CardContent>
            <form
              aria-label="Manual reading"
              className="space-y-6"
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
              <ManualReadingFormAlerts
                outside={outside}
                saveError={saveError}
              />
              <ManualReadingFormFooter
                assetId={fields.assetId}
                estateId={estateId}
                pending={mutation.isPending}
                saved={saved}
              />
            </form>
          </CardContent>
        </Card>
      ) : null}
    </PageLayout>
  );
}
