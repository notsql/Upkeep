import { Button } from "@proj/ui/components/button";
import { Input } from "@proj/ui/components/input";
import { Label } from "@proj/ui/components/label";
import { type ChangeEvent, useCallback } from "react";

export interface SelectedReportImage {
  file: File;
  id: number;
}

function SelectedImage({
  image,
  onRemove,
}: {
  image: SelectedReportImage;
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

export function ReportImagesField({
  id,
  images,
  onChange,
  onRemove,
}: {
  id: string;
  images: SelectedReportImage[];
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemove: (id: number) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={`${id}-images`}>Images (optional)</Label>
      <Input
        accept="image/*"
        aria-describedby={`${id}-images-help`}
        id={`${id}-images`}
        multiple
        onChange={onChange}
        type="file"
      />
      <p className="text-muted-foreground text-sm" id={`${id}-images-help`}>
        Choose photos from your device. On supported phones, you can also take a
        photo from the chooser. Up to 3 JPEG or PNG images, 5 MB each.
      </p>
      {images.map((image) => (
        <SelectedImage image={image} key={image.id} onRemove={onRemove} />
      ))}
    </div>
  );
}
