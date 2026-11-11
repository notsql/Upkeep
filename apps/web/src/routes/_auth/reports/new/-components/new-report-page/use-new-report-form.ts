import { useNavigate } from "@tanstack/react-router";
import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useId,
  useRef,
  useState,
} from "react";
import {
  type ReportEstate,
  useCreateReport,
  useResidentLocations,
} from "@/lib/reports";
import type { SelectedReportImage } from "@/routes/_auth/reports/new/-components/new-report-page/selected-image";

function initialEstate(
  estates: ReportEstate[],
  requestedId?: string
): ReportEstate | undefined {
  if (requestedId) {
    return estates.find((own) => own.id === requestedId);
  }
  return estates.length === 1 ? estates[0] : undefined;
}

export function useNewReportForm(
  estates: ReportEstate[],
  initialEstateId?: string
) {
  const id = useId();
  const navigate = useNavigate();
  const create = useCreateReport();
  // A requested estate is preselected only if it is one of the user's own.
  const [estate, setEstate] = useState<ReportEstate | undefined>(() =>
    initialEstate(estates, initialEstateId)
  );
  const estateId = estate?.id;
  const estateName = estate?.name ?? "Choose an estate";
  const locations = useResidentLocations(estateId);
  const [blockId, setBlockId] = useState<string | null>(null);
  const [levelId, setLevelId] = useState<string | null>(null);
  const [commonId, setCommonId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<SelectedReportImage[]>([]);
  const nextImageId = useRef(0);
  const [error, setError] = useState<string>();
  const submit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (create.isPending) {
        return;
      }
      const reportTitle = title.trim();
      if (!reportTitle || reportTitle.length > 50) {
        setError("Enter a title in 1 to 50 characters.");
        return;
      }
      const locationId = commonId ?? levelId;
      if (!(estateId && description.trim() && blockId && locationId)) {
        setError(
          "Enter a description and choose a block plus a level or common area."
        );
        return;
      }
      setError(undefined);
      try {
        const report = await create.mutateAsync({
          estateId,
          title: reportTitle,
          description: description.trim(),
          locationId,
          images: images.map(({ file }) => file),
        });
        if (report.id) {
          await navigate({
            to: "/reports/$reportId",
            params: { reportId: report.id },
          });
        }
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Couldn't submit. Check My reports before trying again."
        );
      }
    },
    [
      blockId,
      commonId,
      create.isPending,
      create.mutateAsync,
      description,
      estateId,
      images,
      levelId,
      navigate,
      title,
    ]
  );

  const changeEstate = useCallback(
    (value: ReportEstate | null) => {
      setEstate(value ?? undefined);
      setBlockId(null);
      setLevelId(null);
      setCommonId(null);
      // Only the user's own estates live in the URL: the page remounts on it,
      // and another estate's name could not be shown again after reload.
      if (value && estates.some((own) => own.id === value.id)) {
        navigate({ to: "/reports/new", search: { estateId: value.id } });
      }
    },
    [estates, navigate]
  );
  const changeBlock = useCallback((value: string | null) => {
    setBlockId(value);
    setLevelId(null);
    setCommonId(null);
  }, []);
  const changeLevel = useCallback((value: string | null) => {
    setLevelId(value);
    setCommonId(null);
  }, []);
  const changeDescription = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) =>
      setDescription(event.target.value),
    []
  );
  const changeTitle = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setTitle(event.target.value),
    []
  );
  const changeImages = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const added = Array.from(event.target.files ?? []);
      if (images.length + added.length > 3) {
        setError("Choose at most three images.");
        return;
      }
      if (added.some((file) => file.size > 5 * 1024 * 1024)) {
        setError("Each image must be at most 5 MB.");
        return;
      }
      setImages((current) => [
        ...current,
        ...added.map((file) => {
          const image = { id: nextImageId.current, file };
          nextImageId.current += 1;
          return image;
        }),
      ]);
      event.target.value = "";
    },
    [images.length]
  );
  const removeImage = useCallback(
    (imageId: number) =>
      setImages((current) => current.filter((image) => image.id !== imageId)),
    []
  );

  return {
    blockId,
    changeBlock,
    changeDescription,
    changeEstate,
    changeImages,
    changeLevel,
    changeTitle,
    commonId,
    create,
    description,
    error,
    estate,
    estateId,
    estateName,
    id,
    images,
    levelId,
    locations,
    removeImage,
    setCommonId,
    submit,
    title,
  };
}
