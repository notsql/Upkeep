import { Button } from "@proj/ui/components/button";
import { Spinner } from "@proj/ui/components/spinner";
import { useCallback, useEffect, useRef } from "react";

/**
 * The bottom of a phone-width infinite list. An invisible sentinel asks for
 * the next page as it nears the viewport; below it sits a quiet loading row
 * or, once nothing is left, an end-of-list line.
 */
export function LoadMore({
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  failed = false,
}: {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => unknown;
  /** The last next-page request failed: stop auto-loading, offer a retry. */
  failed?: boolean;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const retry = useCallback(() => fetchNextPage(), [fetchNextPage]);
  const ready = hasNextPage && !isFetchingNextPage && !failed;
  useEffect(() => {
    const target = sentinel.current;
    if (!(ready && target)) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          fetchNextPage();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [ready, fetchNextPage]);
  return (
    <div className="text-muted-foreground py-3 text-center text-sm">
      <div aria-hidden="true" ref={sentinel} />
      {isFetchingNextPage ? (
        <div
          aria-label="Loading more…"
          className="flex items-center justify-center gap-2"
          role="status"
        >
          <Spinner aria-hidden="true" role="presentation" />
          <span>Loading more…</span>
        </div>
      ) : null}
      {failed && !isFetchingNextPage ? (
        <div className="flex items-center justify-center gap-2">
          <span>Couldn't load more.</span>
          <Button onClick={retry} size="sm" variant="outline">
            Try again
          </Button>
        </div>
      ) : null}
      {hasNextPage ? null : <p>That's everything</p>}
    </div>
  );
}
