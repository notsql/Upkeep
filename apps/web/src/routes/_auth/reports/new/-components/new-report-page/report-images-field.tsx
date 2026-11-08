import { Field, FieldDescription, FieldLabel } from "@proj/ui/components/field";
import { Input } from "@proj/ui/components/input";
import type { ChangeEvent } from "react";
import {
  SelectedImage,
  type SelectedReportImage,
} from "@/routes/_auth/reports/new/-components/new-report-page/selected-image";

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
    <Field>
      <FieldLabel htmlFor={`${id}-images`}>Images (optional)</FieldLabel>
      <Input
        accept="image/*"
        aria-describedby={`${id}-images-help`}
        id={`${id}-images`}
        multiple
        onChange={onChange}
        type="file"
      />
      <FieldDescription id={`${id}-images-help`}>
        Choose photos from your device. On supported phones, you can also take a
        photo from the chooser. Up to 3 JPEG or PNG images, 5 MB each.
      </FieldDescription>
      {images.map((image) => (
        <SelectedImage image={image} key={image.id} onRemove={onRemove} />
      ))}
    </Field>
  );
}
