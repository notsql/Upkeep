import { Input } from "@proj/ui/components/input";
import { Label } from "@proj/ui/components/label";
import type { ChangeEvent } from "react";
import {
  SelectedImage,
  type SelectedReportImage,
} from "@/routes/_auth/reports/new/-components/selected-image";

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
