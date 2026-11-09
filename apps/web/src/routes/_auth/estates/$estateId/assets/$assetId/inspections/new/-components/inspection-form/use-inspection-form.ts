import { useNavigate } from "@tanstack/react-router";
import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  type InspectionAsset,
  type InspectionInput,
  type InspectionResult,
  useCreateInspection,
  useInspectionAccess,
  useInspectionAsset,
} from "@/lib/inspections";
import type { SelectedInspectionPhoto } from "@/routes/_auth/estates/$estateId/assets/$assetId/inspections/new/-components/inspection-form/inspection-photo-field";

export function useInspectionForm(estateId: string, assetId: string) {
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
  const [notesError, setNotesError] = useState<string>();
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
      if (outcome === "FAIL" && !notes.trim()) {
        setNotesError("Say what's wrong so the manager knows what to fix.");
        return;
      }
      setNotesError(undefined);
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
                  "Couldn't confirm the save. Refresh inspection history before submitting again."
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
  const changeNotes = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    setNotes(event.target.value);
    setNotesError(undefined);
  }, []);
  const removePhoto = useCallback(
    (id: string) =>
      setPhotos((previous) => previous.filter((photo) => photo.id !== id)),
    []
  );
  return {
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
  };
}
