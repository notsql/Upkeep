import { Button } from "@proj/ui/components/button";

export function ReadingsPagination({
  onNext,
  onPrevious,
  page,
  pages,
  total,
}: {
  onNext: () => void;
  onPrevious: () => void;
  page: number;
  pages: number;
  total: number;
}) {
  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-muted-foreground text-sm">
        {`Page ${page + 1} of ${pages} · ${total} ${total === 1 ? "reading" : "readings"}`}
      </p>
      <div className="flex gap-2">
        <Button disabled={page <= 0} onClick={onPrevious} variant="outline">
          Previous page
        </Button>
        <Button disabled={page >= pages - 1} onClick={onNext} variant="outline">
          Next page
        </Button>
      </div>
    </nav>
  );
}
