import { Button, buttonVariants } from "@proj/ui/components/button";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { PageHeader } from "@/components/page-header";
import {
  type InspectionAsset,
  type InspectionInput,
  type InspectionResult,
  useCreateInspection,
  useInspectionAccess,
  useInspectionAsset,
} from "@/lib/inspections";
import { InspectionFields } from "./inspection-fields";
import { InspectionFormFeedback } from "./inspection-form-feedback";
import {
  InspectionPhotoField,
  type SelectedInspectionPhoto,
} from "./inspection-photo-field";
import { SavedInspectionNotice } from "./saved-inspection-notice";

export function InspectionForm({
  estateId,
  assetId,
}: {
  estateId: string;
  assetId: string;
}) {
  const access = useInspectionAccess(estateId);
  const asset = useInspectionAsset(estateId, assetId);
  const save = useCreateInspection(estateId, assetId);
  const navigate = useNavigate();
  const [outcome, setOutcome] = useState<InspectionInput["outcome"] | "">("");
  const [date, setDate] = useState(() =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore" }).format(
      new Date()
    )
  );
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<SelectedInspectionPhoto[]>([]);
  const [observed, setObserved] = useState<InspectionAsset>();
  const [review, setReview] = useState<InspectionAsset>();
  const [error, setError] = useState<Error | undefined>(undefined);
  const [saved, setSaved] = useState<InspectionResult>();
  const saving = useRef<boolean>(false);
  useEffect(() => {
    if (!observed && asset.data) {
      setObserved(asset.data);
    }
  }, [observed, asset.data]);
  const addPhotos = useCallback((files: File[]) => {
    setPhotos((previous) => [
      ...previous,
      ...files.map((file) => ({ id: crypto.randomUUID(), file })),
    ]);
  }, []);
  const submit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (saving.current || save.isPending || !outcome || !observed || review) {
        return;
      }
      saving.current = true;
      setError(undefined);
      let result: InspectionResult | undefined;
      try {
        result = await save.mutateAsync({
          outcome,
          inspectedOn: date,
          notes,
          expectedLocationId: observed.locationId,
          photos: photos.map((photo) => photo.file),
        });
        setSaved(result);
        if (result.outcome === "FAIL" && access.canCreateWorkOrders) {
          await navigate({
            to: "/estates/$estateId/work-orders/new",
            params: { estateId },
            search: { sourceInspectionId: result.id },
          });
        } else if (result.outcome === "FAIL") {
          await navigate({
            to: "/estates/$estateId/assets/$assetId",
            params: { estateId, assetId },
          });
        } else {
          await navigate({
            to: "/estates/$estateId/assets/$assetId/inspections/$inspectionId",
            params: { estateId, assetId, inspectionId: result.id },
          });
        }
      } catch (failure) {
        if (result) {
          setError(
            new Error(
              "The inspection was saved. Open the saved record to continue."
            )
          );
        } else {
          setError(
            failure instanceof Error
              ? failure
              : new Error(
                  "Unable to confirm the save. Refresh inspection history before submitting again."
                )
          );
        }
      } finally {
        saving.current = false;
      }
    },
    [
      save.isPending,
      save.mutateAsync,
      outcome,
      observed,
      review,
      date,
      notes,
      photos,
      access.canCreateWorkOrders,
      navigate,
      estateId,
      assetId,
    ]
  );
  const refreshLocation = useCallback(async () => {
    const latest = await asset.refetch();
    if (latest.data) {
      setReview(latest.data);
    }
  }, [asset.refetch]);
  const confirmLocation = useCallback(() => {
    if (review) {
      setObserved(review);
      setReview(undefined);
      setError(undefined);
    }
  }, [review]);
  const retryAsset = useCallback(() => asset.refetch(), [asset.refetch]);
  const changeOutcome = useCallback(
    (value: string | null) =>
      setOutcome(value === "PASS" || value === "FAIL" ? value : ""),
    []
  );
  const changeDate = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setDate(event.target.value),
    []
  );
  const changeNotes = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => setNotes(event.target.value),
    []
  );
  const removePhoto = useCallback(
    (id: string) =>
      setPhotos((previous) => previous.filter((photo) => photo.id !== id)),
    []
  );
  if (access.pending) {
    return <p role="status">Loading access…</p>;
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
      <main className="page-layout">
        <p role="alert">{asset.error.message}</p>
        <Button onClick={retryAsset}>Retry asset</Button>
      </main>
    );
  }
  if (!observed) {
    return <p role="status">Loading asset…</p>;
  }
  const active =
    observed.estateActive && observed.assetActive && observed.locationActive;
  return (
    <main className="page-layout space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Estates", to: "/estates" },
          {
            label: access.estateName ?? "Estate",
            to: "/estates/$estateId",
            params: { estateId },
          },
          {
            label: observed.name,
            to: "/estates/$estateId/assets/$assetId",
            params: { estateId, assetId },
          },
          { label: "Create inspection record" },
        ]}
        description={`${observed.reference} · ${observed.name}`}
        title="Create inspection record"
      />
      <dl className="detail-grid">
        <div>
          <dt>Asset</dt>
          <dd>
            {observed.reference} · {observed.name}
          </dd>
        </div>
        <div>
          <dt>Location</dt>
          <dd>{observed.locationPath}</dd>
        </div>
      </dl>
      {active ? null : (
        <p role="alert">
          This estate, asset or location is inactive or retired. Existing
          records remain available.
        </p>
      )}
      <form className="form-layout grid max-w-3xl gap-5" onSubmit={submit}>
        <InspectionFields
          date={date}
          installedOn={observed.installedOn}
          notes={notes}
          onDateChange={changeDate}
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
    </main>
  );
}
