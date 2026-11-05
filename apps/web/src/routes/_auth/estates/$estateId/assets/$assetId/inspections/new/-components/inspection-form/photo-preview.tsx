import { Button } from "@proj/ui/components/button";
import { useCallback, useEffect, useState } from "react";

export function PhotoPreview({
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
      <p className="text-sm break-all">{file.name}</p>
      <Button onClick={remove} type="button" variant="outline">
        Remove {file.name}
      </Button>
    </li>
  );
}
