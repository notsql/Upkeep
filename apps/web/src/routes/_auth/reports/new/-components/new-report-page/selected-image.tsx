import { Button } from "@proj/ui/components/button";
import { useCallback, useEffect, useState } from "react";

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
  const [url, setUrl] = useState<string>();
  const remove = useCallback(() => onRemove(image.id), [image.id, onRemove]);
  // A local preview so residents can check the photo before sending it.
  useEffect(() => {
    const objectUrl = URL.createObjectURL(image.file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [image.file]);
  return (
    <div className="flex items-center gap-3">
      {url ? (
        <img
          alt={`Selected photo: ${image.file.name}`}
          className="size-16 shrink-0 rounded-md border object-cover"
          height={64}
          src={url}
          width={64}
        />
      ) : null}
      <span className="min-w-0 flex-1 text-sm break-all">
        {image.file.name}
      </span>
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
