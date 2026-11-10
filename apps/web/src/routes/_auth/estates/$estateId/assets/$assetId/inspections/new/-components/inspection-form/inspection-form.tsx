import { FieldSeparator } from "@proj/ui/components/field";
import { useNavigate } from "@tanstack/react-router";
import { ClipboardCheck } from "lucide-react";
import { type ReactNode, useCallback } from "react";
import { FormActions } from "@/components/forms/form-actions";
import { FormCard, FormPage } from "@/components/page/form-page";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { InspectionFields } from "@/routes/_auth/estates/$estateId/assets/$assetId/inspections/new/-components/inspection-form/inspection-fields";
import { InspectionFormAssetSummary } from "@/routes/_auth/estates/$estateId/assets/$assetId/inspections/new/-components/inspection-form/inspection-form-asset-summary";
import { InspectionFormFeedback } from "@/routes/_auth/estates/$estateId/assets/$assetId/inspections/new/-components/inspection-form/inspection-form-feedback";
import { InspectionPhotoField } from "@/routes/_auth/estates/$estateId/assets/$assetId/inspections/new/-components/inspection-form/inspection-photo-field";
import { SavedInspectionNotice } from "@/routes/_auth/estates/$estateId/assets/$assetId/inspections/new/-components/inspection-form/saved-inspection-notice";
import { useInspectionForm } from "@/routes/_auth/estates/$estateId/assets/$assetId/inspections/new/-components/inspection-form/use-inspection-form";

const TITLE = "Create inspection record";

function InspectionFormPage({
  estateId,
  assetId,
  assetName,
  description,
  children,
}: {
  estateId: string;
  assetId: string;
  assetName?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <FormPage
      breadcrumbs={[
        {
          label: assetName ?? "Asset",
          to: "/estates/$estateId/assets/$assetId",
          params: { estateId, assetId },
        },
        { label: TITLE },
      ]}
      description={description}
      icon={ClipboardCheck}
      title={TITLE}
    >
      {children}
    </FormPage>
  );
}

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
    notesError,
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
  const navigate = useNavigate();
  const cancel = useCallback(() => {
    navigate({
      to: "/estates/$estateId/assets/$assetId",
      params: { estateId, assetId },
    });
  }, [navigate, estateId, assetId]);
  let state: ReactNode = null;
  if (access.pending) {
    state = <LoadingState label="Loading access…" rows={2} />;
  } else if (!access.canCreate) {
    state = <p role="alert">Inspection recording is unavailable.</p>;
  } else if (saved) {
    return (
      <SavedInspectionNotice
        assetId={assetId}
        error={error}
        estateId={estateId}
        saved={saved}
      />
    );
  } else if (asset.isError) {
    state = (
      <ErrorState
        message={asset.error.message}
        onRetry={retryAsset}
        retryLabel="Retry asset"
      />
    );
  } else if (!observed) {
    state = <LoadingState label="Loading asset…" rows={2} />;
  }
  if (state || !observed) {
    return (
      <InspectionFormPage assetId={assetId} estateId={estateId}>
        {state}
      </InspectionFormPage>
    );
  }
  const active =
    observed.estateActive && observed.assetActive && observed.locationActive;
  return (
    <InspectionFormPage
      assetId={assetId}
      assetName={observed.name}
      description={`${observed.reference} · ${observed.name}`}
      estateId={estateId}
    >
      <InspectionFormAssetSummary active={active} observed={observed} />
      <FormCard>
        <form className="grid gap-5" onSubmit={submit}>
          <InspectionFields
            date={date}
            installedOn={observed.installedOn}
            notes={notes}
            notesError={notesError}
            onDateChange={setDate}
            onNotesChange={changeNotes}
            onOutcomeChange={changeOutcome}
            outcome={outcome}
          />
          <FieldSeparator />
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
          <FormActions
            disabled={!active || !!review}
            label={save.isPending ? "Saving…" : "Save inspection record"}
            onCancel={cancel}
            pending={save.isPending}
          />
        </form>
      </FormCard>
    </InspectionFormPage>
  );
}
