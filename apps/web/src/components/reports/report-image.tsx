import { type ReactNode, useEffect, useState } from "react";

export function ReportImage({
  data,
  isError,
  loading = null,
}: {
  data: Blob | undefined;
  isError: boolean;
  loading?: ReactNode;
}) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!data) {
      setUrl(undefined);
      return;
    }
    const objectUrl = URL.createObjectURL(data);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [data]);
  if (isError) {
    return <p role="alert">Unable to load an image.</p>;
  }
  if (!url) {
    return loading;
  }
  return (
    <img
      alt="Submitted fault"
      className="h-auto w-full rounded-md object-contain"
      height={384}
      src={url}
      width={512}
    />
  );
}
