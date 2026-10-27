import type { components } from "@proj/api/schema";
import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@proj/ui/components/card";
import { useNavigate } from "@tanstack/react-router";
import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useId,
  useRef,
  useState,
} from "react";
import { useCreateReport, useResidentLocations } from "@/lib/reports";
import { ReportDetailsFields } from "@/routes/_auth/reports/new/-components/report-details-fields";
import {
  ReportImagesField,
  type SelectedReportImage,
} from "@/routes/_auth/reports/new/-components/report-images-field";
import { ReportLocationFields } from "@/routes/_auth/reports/new/-components/report-location-fields";
import { ResidentEstateSelector } from "@/routes/_auth/reports/new/-components/resident-estate-selector";

export function NewReportForm({
  estates,
  initialEstateId,
}: {
  estates: components["schemas"]["ResidentContextResponse"]["estates"];
  initialEstateId?: string;
}) {
  const id = useId();
  const navigate = useNavigate();
  const create = useCreateReport();
  const [selectedEstateId, setSelectedEstateId] = useState<string | null>(
    initialEstateId ?? null
  );
  const estateId =
    selectedEstateId ?? (estates.length === 1 ? estates[0]?.id : undefined);
  const estateName =
    estates.find((estate) => estate.id === estateId)?.name ??
    "Choose an estate";
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
      estateId,
      images,
      levelId,
      navigate,
      title,
    ]
  );

  const changeEstate = useCallback(
    (value: string | null) => {
      setSelectedEstateId(value);
      setBlockId(null);
      setLevelId(null);
      setCommonId(null);
      navigate({
        to: "/reports/new",
        search: { estateId: value ?? undefined },
      });
    },
    [navigate]
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
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>{estateName}</CardTitle>
      </CardHeader>
      <CardContent>
        {locations.isLoading ? <p role="status">Loading locations…</p> : null}
        {locations.isError ? (
          <Alert role="alert" variant="destructive">
            <AlertDescription>
              Unable to load locations. Please try again.
            </AlertDescription>
          </Alert>
        ) : null}
        <form className="grid gap-4" onSubmit={submit}>
          <ResidentEstateSelector
            estateId={estateId}
            estates={estates}
            id={id}
            onChange={changeEstate}
          />
          <ReportLocationFields
            blockId={blockId}
            commonId={commonId}
            id={id}
            levelId={levelId}
            locations={locations.data ?? []}
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
          <p className="text-muted-foreground text-sm">
            To get your report to the right people quickly, its text and photos
            are analysed by an AI service (Anthropic) and may be emailed to the
            estate's contractor. Please don't include personal details you don't
            want shared.
          </p>
          <Button
            disabled={
              create.isPending ||
              !estateId ||
              locations.isPending ||
              locations.isError
            }
            type="submit"
          >
            {create.isPending ? "Submitting…" : "Submit report"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
