import type { ReactNode } from "react";

/** A submitted fault photo, shown straight from its short-lived storage link. */
export function ReportImage({
  url,
  isError,
  loading = null,
}: {
  url: string | undefined;
  isError: boolean;
  loading?: ReactNode;
}) {
  if (isError) {
    return <p role="alert">Couldn't load an image. Try again.</p>;
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
