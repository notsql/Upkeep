import { Button } from "@proj/ui/components/button";
import { Field, FieldLabel } from "@proj/ui/components/field";
import { Input } from "@proj/ui/components/input";
import { type ChangeEvent, useCallback, useEffect, useState } from "react";

export interface SelectedInspectionPhoto {
  file: File;
  id: string;
}

function PhotoPreview({
  file,
  id,
  onRemove,
}: {
  file: File;
  id: string;
  onRemove: (id: string) => void;
}) {
  const [url, setUrl] = useState<string>();
  const remove = useCallback(() => onRemove(id), [onRemove, id]);
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return (
    <li className="space-y-2 rounded-lg border p-3">
      {url ? (
        <img
          alt={`Selected evidence: ${file.name}`}
          className="h-32 w-full rounded object-contain"
          height={128}
          src={url}
          width={320}
        />
      ) : null}
      <p className="break-all text-sm">{file.name}</p>
      <Button onClick={remove} type="button" variant="outline">
        Remove {file.name}
      </Button>
    </li>
  );
}

export function InspectionPhotoField({
  photos,
  onSelect,
  onRemove,
  onError,
}: {
  photos: SelectedInspectionPhoto[];
  onSelect: (files: File[]) => void;
  onRemove: (id: string) => void;
  onError: (error: Error | undefined) => void;
}) {
  const selectPhotos = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      const invalid = files.some(
        (file) =>
          !["image/jpeg", "image/png"].includes(file.type) ||
          file.size > 5 * 1024 * 1024
      );
      if (files.length + photos.length > 3 || invalid) {
        onError(
          new Error(
            "Choose at most three JPEG/PNG photos, up to 5 MB each and 4,032 × 3,024 pixels."
          )
        );
        event.target.value = "";
        return;
      }
      onSelect(files);
      onError(undefined);
      event.target.value = "";
    },
    [photos.length, onSelect, onError]
  );
  return (
    <>
      <Field>
        <FieldLabel htmlFor="inspection-photos">Photos (optional)</FieldLabel>
        <Input
          accept="image/jpeg,image/png"
          id="inspection-photos"
          multiple
          onChange={selectPhotos}
          type="file"
        />
        <p className="text-muted-foreground text-sm">
          Up to 3 JPEG/PNG photos, 5 MB each, maximum 4,032 × 3,024 pixels.
        </p>
      </Field>
      <ul className="grid gap-3 sm:grid-cols-3">
        {photos.map((photo) => (
          <PhotoPreview
            file={photo.file}
            id={photo.id}
            key={photo.id}
            onRemove={onRemove}
          />
        ))}
      </ul>
    </>
  );
}
