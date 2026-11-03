import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import { Spinner } from "@proj/ui/components/spinner";
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
    <div className="min-w-0 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={disabled || download.isPending}
          onClick={download.start}
          type="button"
          variant="outline"
        >
          {download.isPending ? <Spinner aria-hidden="true" /> : null}{" "}
          {download.isPending ? "Exporting CSV…" : "Export CSV"}
        </Button>
        {download.isPending ? (
          <Button onClick={download.cancel} type="button" variant="outline">
            Cancel export
          </Button>
        ) : null}
      </div>
      <p className="text-muted-foreground text-xs">
        Exports all matching readings, across every page.
      </p>
      {download.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{download.error.message}</AlertDescription>
        </Alert>
      ) : null}
      {download.cancelled ? <p role="status">Export cancelled.</p> : null}
    </div>
  );
}
