import { useCallback, useMemo, useState } from "react";
import { useFilterPanel } from "@/components/filter-bar";
import {
  type WorkOrderFilters as Filters,
  useWorkOrderAccess,
  useWorkOrderList,
  type WorkOrderListSearch,
} from "@/lib/work-orders";
import { countWorkOrderFilters } from "./work-order-filters";

export function useWorkOrderListPage(
  estateId: string,
  search: WorkOrderListSearch,
  onChange: (search: WorkOrderListSearch) => void
) {
  const access = useWorkOrderAccess(estateId);
  const { priority, q, status, category, cursor, sortBy, direction } = search;
  const descending = (direction ?? "DESC") === "DESC";
  const filters = { priority, q, status, category };
  const options = useMemo(
    () => ({
      priority,
      q,
      status,
      category,
      ...(sortBy ? { sortBy } : {}),
      ...(direction ? { direction } : {}),
    }),
    [priority, q, status, category, sortBy, direction]
  );
  const scope = JSON.stringify([access.userId, estateId, options]);
  const [trail, setTrail] = useState<{
    scope: string;
    cursors: (string | undefined)[];
  }>({ scope, cursors: [] });
  const cursors = trail.scope === scope ? trail.cursors : [];
  const currentIndex = cursors.indexOf(cursor);
  // A directly opened cursor has no known previous page: go to the first.
  const canPrevious = currentIndex > 0 || (currentIndex < 0 && !!cursor);
  const previous = useCallback(() => {
    if (currentIndex > 0) {
      onChange({ ...options, cursor: cursors[currentIndex - 1] });
      return;
    }
    onChange(options);
  }, [onChange, options, cursors, currentIndex]);
  const activeCount = countWorkOrderFilters(filters);
  const filtered = activeCount > 0;
  const panel = useFilterPanel(activeCount);
  const orders = useWorkOrderList(estateId, options, cursor);
  const changeFilters = useCallback(
    (values: Filters) => {
      setTrail({ scope: "", cursors: [] });
      onChange({
        ...values,
        ...(sortBy ? { sortBy } : {}),
        ...(direction ? { direction } : {}),
      });
    },
    [onChange, sortBy, direction]
  );
  const changeSort = useCallback(
    (column: NonNullable<WorkOrderListSearch["sortBy"]>) => {
      let nextDirection: NonNullable<WorkOrderListSearch["direction"]> =
        column === "PRIORITY" || column === "CREATED_AT" ? "DESC" : "ASC";
      if ((sortBy ?? "CREATED_AT") === column) {
        nextDirection = descending ? "ASC" : "DESC";
      }
      setTrail({ scope: "", cursors: [] });
      onChange({ ...options, sortBy: column, direction: nextDirection });
    },
    [options, onChange, sortBy, descending]
  );
  const retry = useCallback(() => orders.refetch(), [orders.refetch]);
  const clearFilters = useCallback(() => changeFilters({}), [changeFilters]);
  const next = useCallback(() => {
    const nextCursor = orders.data?.nextCursor;
    if (!nextCursor) {
      return;
    }
    setTrail({
      scope,
      cursors: [
        ...(currentIndex >= 0 ? cursors.slice(0, currentIndex + 1) : [cursor]),
        nextCursor,
      ],
    });
    onChange({ ...options, cursor: nextCursor });
  }, [
    onChange,
    options,
    orders.data?.nextCursor,
    scope,
    currentIndex,
    cursors,
    cursor,
  ]);
  return {
    access,
    activeCount,
    canPrevious,
    changeFilters,
    changeSort,
    clearFilters,
    descending,
    filtered,
    filters,
    next,
    orders,
    panel,
    previous,
    retry,
    sortBy: sortBy ?? "CREATED_AT",
  };
}
