import type {
  InfiniteData,
  UseInfiniteQueryResult,
} from "@tanstack/react-query";

/** What `LoadMore` needs to drive a phone-width infinite list. */
export interface LoadMoreControls {
  failed?: boolean;
  fetchNextPage: () => unknown;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
}

/**
 * The subset of a page query a list screen reads. A desktop `useQuery` page
 * satisfies it as is; `asPagedList` reshapes a mobile infinite query into it,
 * so one results component renders either.
 */
export interface PagedList<P> {
  data: P | undefined;
  error: Error | null;
  isError: boolean;
  isFetching: boolean;
  isPending: boolean;
  isPlaceholderData: boolean;
  more?: LoadMoreControls;
  refetch: () => unknown;
}

/**
 * Flattens every loaded page's `items` into one page shaped like the last
 * response (so `nextCursor`/`totalItems` still read naturally), and exposes
 * the controls for `LoadMore`.
 */
export function asPagedList<P extends { items?: unknown[] }>(
  query: UseInfiniteQueryResult<InfiniteData<P>>
): PagedList<P> & { more: LoadMoreControls } {
  const pages = query.data?.pages ?? [];
  const last = pages.at(-1);
  return {
    data: last
      ? { ...last, items: pages.flatMap((page) => page.items ?? []) }
      : undefined,
    isPending: query.isPending,
    isError: query.isError && !query.isFetchNextPageError,
    error: query.isFetchNextPageError ? null : query.error,
    isFetching: query.isFetching && !query.isFetchingNextPage,
    isPlaceholderData: false,
    refetch: query.refetch,
    more: {
      hasNextPage: query.hasNextPage,
      isFetchingNextPage: query.isFetchingNextPage,
      fetchNextPage: query.fetchNextPage,
      failed: query.isFetchNextPageError,
    },
  };
}
