import { Button } from "@proj/ui/components/button";
import { useCallback } from "react";

export interface SelectedReportImage {
  file: File;
  id: number;
}

export function SelectedImage({
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
