import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@proj/ui/components/card";
import { Input } from "@proj/ui/components/input";
import { Label } from "@proj/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";
import { Textarea } from "@proj/ui/components/textarea";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useId,
  useRef,
  useState,
} from "react";
import {
  useCreateReport,
  useResidentContext,
  useResidentLocations,
} from "@/lib/reports";

export const Route = createFileRoute("/_auth/reports/new/")({
  component: NewReportPage,
  head: () => ({ meta: [{ title: "Report a fault" }] }),
});

interface SelectedFile {
  file: File;
  id: number;
}

function SelectedImage({
  image,
  onRemove,
}: {
  image: SelectedFile;
  onRemove: (id: number) => void;
}) {
  const remove = useCallback(() => onRemove(image.id), [image.id, onRemove]);
  return (
    <div className="flex items-center justify-between">
      <span>{image.file.name}</span>
      <Button
        aria-label={`Remove ${image.file.name}`}
        onClick={remove}
        type="button"
        variant="outline"
      >
        Remove
      </Button>
    </div>
  );
}

function NewReportPage() {
  const id = useId();
  const navigate = useNavigate();
  const context = useResidentContext();
  const locations = useResidentLocations();
  const create = useCreateReport();
  const [blockId, setBlockId] = useState<string | null>(null);
  const [levelId, setLevelId] = useState<string | null>(null);
  const [commonId, setCommonId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<SelectedFile[]>([]);
  const nextImageId = useRef(0);
  const [error, setError] = useState<string>();
  const choices = locations.data ?? [];
  const blocks = choices.filter((item) => item.type === "BLOCK" && item.id);
  const levels = choices.filter(
    (item) => item.type === "LEVEL" && item.parentId === blockId && item.id
  );
  const commonAreas = choices.filter(
    (item) =>
      item.type === "COMMON_AREA" &&
      item.id &&
      (item.parentId === blockId || item.parentId === levelId)
  );

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
    <main className="page-layout">
      {context.data ? (
        <h1 className="mb-4 font-semibold text-2xl">Report a fault</h1>
      ) : null}
      {context.isPending ? <p role="status">Loading your estate…</p> : null}
      {context.isError ? (
        <Alert role="alert" variant="destructive">
          <AlertDescription>
            Unable to load your estate assignment. Please try again.
          </AlertDescription>
        </Alert>
      ) : null}
      {context.data && !context.data.canSubmit ? (
        <Alert role="alert">
          <AlertDescription>
            You have no estate assigned. Contact your estate manager before
            reporting a fault.
          </AlertDescription>
        </Alert>
      ) : null}
      {context.data?.canSubmit ? (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>{context.data.estate?.name}</CardTitle>
          </CardHeader>
          <CardContent>
            {locations.isPending ? (
              <p role="status">Loading locations…</p>
            ) : null}
            {locations.isError ? (
              <Alert role="alert" variant="destructive">
                <AlertDescription>
                  Unable to load locations. Please try again.
                </AlertDescription>
              </Alert>
            ) : null}
            <form className="grid gap-4" onSubmit={submit}>
              <div className="grid gap-2">
                <Label htmlFor={`${id}-block`}>Block</Label>
                <Select
                  items={blocks.map((block) => ({
                    value: block.id ?? "",
                    label: block.name ?? "",
                  }))}
                  onValueChange={changeBlock}
                  value={blockId}
                >
                  <SelectTrigger className="w-full" id={`${id}-block`}>
                    <SelectValue placeholder="Choose block" />
                  </SelectTrigger>
                  <SelectContent>
                    {blocks.map((block) => (
                      <SelectItem key={block.id} value={block.id ?? ""}>
                        {block.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`${id}-level`}>Level</Label>
                <Select
                  disabled={!blockId}
                  items={levels.map((level) => ({
                    value: level.id ?? "",
                    label: level.name ?? "",
                  }))}
                  onValueChange={changeLevel}
                  value={levelId}
                >
                  <SelectTrigger className="w-full" id={`${id}-level`}>
                    <SelectValue placeholder="Choose level" />
                  </SelectTrigger>
                  <SelectContent>
                    {levels.map((level) => (
                      <SelectItem key={level.id} value={level.id ?? ""}>
                        {level.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {commonAreas.length > 0 ? (
                <div className="grid gap-2">
                  <Label htmlFor={`${id}-common`}>Common area (optional)</Label>
                  <Select
                    items={commonAreas.map((area) => ({
                      value: area.id ?? "",
                      label: area.name ?? "",
                    }))}
                    onValueChange={setCommonId}
                    value={commonId}
                  >
                    <SelectTrigger className="w-full" id={`${id}-common`}>
                      <SelectValue placeholder="Choose common area" />
                    </SelectTrigger>
                    <SelectContent>
                      {commonAreas.map((area) => (
                        <SelectItem key={area.id} value={area.id ?? ""}>
                          {area.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <div className="grid gap-2">
                <Label htmlFor={`${id}-title`}>Title</Label>
                <Input
                  aria-describedby={`${id}-title-help`}
                  id={`${id}-title`}
                  maxLength={50}
                  onChange={changeTitle}
                  value={title}
                />
                <p
                  className="text-muted-foreground text-sm"
                  id={`${id}-title-help`}
                >
                  Give the fault a short title in up to 50 characters.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`${id}-description`}>Description</Label>
                <Textarea
                  id={`${id}-description`}
                  maxLength={2500}
                  onChange={changeDescription}
                  value={description}
                />
                <p className="text-muted-foreground text-sm">
                  Describe the fault in up to 2,500 characters.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`${id}-images`}>Images (optional)</Label>
                <Input
                  accept="image/*"
                  aria-describedby={`${id}-images-help`}
                  id={`${id}-images`}
                  multiple
                  onChange={changeImages}
                  type="file"
                />
                <p
                  className="text-muted-foreground text-sm"
                  id={`${id}-images-help`}
                >
                  Choose photos from your device. On supported phones, you can
                  also take a photo from the chooser. Up to 3 JPEG or PNG
                  images, 5 MB each.
                </p>
                {images.map((image) => (
                  <SelectedImage
                    image={image}
                    key={image.id}
                    onRemove={removeImage}
                  />
                ))}
              </div>
              {error ? (
                <Alert role="alert" variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              <Button
                disabled={
                  create.isPending || locations.isPending || locations.isError
                }
                type="submit"
              >
                {create.isPending ? "Submitting…" : "Submit report"}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
