import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import { useNavigate } from "@tanstack/react-router";
import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useId,
  useRef,
  useState,
} from "react";
import { type ResidentLocation, useCreateReport } from "@/lib/reports";
import { ReportDetailsFields } from "@/routes/_auth/reports/new/-components/report-details-fields";
import {
  ReportImagesField,
  type SelectedReportImage,
} from "@/routes/_auth/reports/new/-components/report-images-field";
import { ReportLocationFields } from "@/routes/_auth/reports/new/-components/report-location-fields";

export function NewReportForm({
  locations,
  disabled,
}: {
  locations: ResidentLocation[];
  disabled: boolean;
}) {
  const id = useId();
  const navigate = useNavigate();
  const create = useCreateReport();
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
      if (!(description.trim() && blockId && locationId)) {
        setError(
          "Enter a description and choose a block plus a level or common area."
        );
        return;
      }
      setError(undefined);
      try {
        const report = await create.mutateAsync({
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
            : "Unable to submit. Check My reports before trying again."
        );
      }
    },
    [
      blockId,
      commonId,
      create.isPending,
      create.mutateAsync,
      description,
      images,
      levelId,
      navigate,
      title,
    ]
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

  return (
    <form className="grid gap-4" onSubmit={submit}>
      <ReportLocationFields
        blockId={blockId}
        commonId={commonId}
        id={id}
        levelId={levelId}
        locations={locations}
        onBlockChange={changeBlock}
        onCommonChange={setCommonId}
        onLevelChange={changeLevel}
      />
      <ReportDetailsFields
        description={description}
        id={id}
        onDescriptionChange={changeDescription}
        onTitleChange={changeTitle}
        title={title}
      />
      <ReportImagesField
        id={id}
        images={images}
        onChange={changeImages}
        onRemove={removeImage}
      />
      {error ? (
        <Alert role="alert" variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button disabled={create.isPending || disabled} type="submit">
        {create.isPending ? "Submitting…" : "Submit report"}
      </Button>
    </form>
  );
}
