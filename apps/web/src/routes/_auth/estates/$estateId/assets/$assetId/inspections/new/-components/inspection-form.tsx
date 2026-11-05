import { Button, buttonVariants } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { PageLayout } from "@/components/page-layout";
import { InspectionFormAssetSummary } from "@/routes/_auth/estates/$estateId/assets/$assetId/inspections/new/-components/inspection-form-asset-summary";
import { useInspectionForm } from "@/routes/_auth/estates/$estateId/assets/$assetId/inspections/new/-components/use-inspection-form";
import { InspectionFields } from "./inspection-fields";
import { InspectionFormFeedback } from "./inspection-form-feedback";
import { InspectionPhotoField } from "./inspection-photo-field";
import { SavedInspectionNotice } from "./saved-inspection-notice";

export function InspectionForm({
  estateId,
  assetId,
}: {
  estateId: string;
  assetId: string;
}) {
  const {
    access,
    addPhotos,
    asset,
    changeNotes,
    changeOutcome,
    confirmLocation,
    date,
    error,
    notes,
    observed,
    outcome,
    photos,
    refreshLocation,
    removePhoto,
    retryAsset,
    review,
    save,
    saved,
    setDate,
    setError,
    submit,
  } = useInspectionForm(estateId, assetId);
  if (access.pending) {
    return <LoadingState label="Loading access…" rows={2} />;
  }
  if (!access.canCreate) {
    return <p role="alert">Inspection recording is unavailable.</p>;
  }
  if (saved) {
    return (
      <SavedInspectionNotice
        assetId={assetId}
        error={error}
        estateId={estateId}
        saved={saved}
      />
    );
  }
  if (asset.isError) {
    return (
      <PageLayout>
        <ErrorState
          message={asset.error.message}
          onRetry={retryAsset}
          retryLabel="Retry asset"
        />
      </PageLayout>
    );
  }
  if (!observed) {
    return <LoadingState label="Loading asset…" rows={2} />;
  }
  const active =
    observed.estateActive && observed.assetActive && observed.locationActive;
  return (
    <PageLayout className="space-y-6">
      <InspectionFormAssetSummary
        active={active}
        assetId={assetId}
        estateId={estateId}
        observed={observed}
      />
      <form className="form-layout grid max-w-3xl gap-5" onSubmit={submit}>
        <InspectionFields
          date={date}
          installedOn={observed.installedOn}
          notes={notes}
          onDateChange={setDate}
          onNotesChange={changeNotes}
          onOutcomeChange={changeOutcome}
          outcome={outcome}
        />
        <InspectionPhotoField
          onError={setError}
          onRemove={removePhoto}
          onSelect={addPhotos}
          photos={photos}
        />
        <InspectionFormFeedback
          assetId={assetId}
          error={error}
          estateId={estateId}
          observedLocationPath={observed.locationPath}
          onConfirmLocation={confirmLocation}
          onRefreshLocation={refreshLocation}
          reviewLocationPath={review?.locationPath}
        />
        <div className="flex flex-wrap gap-3">
          <Button
            disabled={save.isPending || !active || !!review}
            type="submit"
          >
            {save.isPending ? "Saving…" : "Save inspection record"}
          </Button>
          <Link
            className={buttonVariants({ variant: "outline" })}
            params={{ estateId, assetId }}
            to="/estates/$estateId/assets/$assetId"
          >
            Cancel
          </Link>
        </div>
      </form>
    </PageLayout>
  );
}
