import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import { Spinner } from "@proj/ui/components/spinner";
import { Download } from "lucide-react";
import type { ReadingSearch } from "@/lib/reading-filters";
import { useReadingExport } from "@/lib/use-reading-export";

export function ReadingExport({
  estateId,
  filters,
  disabled,
}: {
  estateId: string;
  filters: ReadingSearch;
  disabled: boolean;
}) {
  const download = useReadingExport(estateId, filters);
  if (!download.allowed) {
    return null;
  }
  return (
    <>
      <Button
        disabled={disabled || download.isPending}
        onClick={download.start}
        size="sm"
        title="Exports all matching readings, across every page."
        type="button"
        variant="outline"
      >
        {download.isPending ? (
          <Spinner aria-hidden="true" />
        ) : (
          <Download aria-hidden="true" />
        )}
        {download.isPending ? "Exporting CSV…" : "Export CSV"}
      </Button>
      {download.isPending ? (
        <Button
          onClick={download.cancel}
          size="sm"
          type="button"
          variant="outline"
        >
          Cancel export
        </Button>
      ) : null}
      {download.isError ? (
        <Alert className="basis-full" variant="destructive">
          <AlertDescription>{download.error.message}</AlertDescription>
        </Alert>
      ) : null}
      {download.cancelled ? (
        <p className="basis-full text-sm" role="status">
          Export cancelled.
        </p>
      ) : null}
    </>
  );
}
