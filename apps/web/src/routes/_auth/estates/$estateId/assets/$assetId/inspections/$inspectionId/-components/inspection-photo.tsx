import { Button } from "@proj/ui/components/button";
import { useCallback, useEffect, useState } from "react";
import { useInspectionPhoto } from "@/lib/inspections";

export function InspectionPhoto({
  estateId,
  assetId,
  inspectionId,
  photoId,
  number,
}: {
  estateId: string;
  assetId: string;
  inspectionId: string;
  photoId: string;
  number: number;
}) {
  const image = useInspectionPhoto(estateId, assetId, inspectionId, photoId);
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!image.data) {
      setUrl(undefined);
      return;
    }
    const objectUrl = URL.createObjectURL(image.data);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [image.data]);
  const retry = useCallback(() => image.refetch(), [image.refetch]);
  if (image.isError) {
    return (
      <div>
        <p>Photo unavailable.</p>
        <Button onClick={retry} variant="outline">
          Retry photo {number}
        </Button>
      </div>
    );
  }
  if (!(url && image.data)) {
    return <p role="status">Loading photo {number}…</p>;
  }
  return (
    <a href={url} rel="noopener" target="_blank">
      <img
        alt={`Inspection evidence ${number}`}
        className="max-h-96 w-full rounded-lg object-contain"
        height={384}
        src={url}
        width={640}
      />
    </a>
  );
}
