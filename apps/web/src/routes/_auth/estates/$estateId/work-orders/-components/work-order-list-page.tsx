import { Button, buttonVariants } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";
import { Plus, Wrench } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { PageLayout } from "@/components/page-layout";
import {
  type WorkOrderFilters as Filters,
  useWorkOrderAccess,
  useWorkOrderList,
  type WorkOrderListSearch,
} from "@/lib/work-orders";
import { WorkOrderFilters } from "./work-order-filters";
import { WorkOrderTable } from "./work-order-table";
export function WorkOrderListPage({
  estateId,
  search,
  onChange,
}: {
  estateId: string;
  search: WorkOrderListSearch;
  onChange: (search: WorkOrderListSearch) => void;
}) {
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
  const canPrevious = currentIndex > 0;
  const previous = useCallback(() => {
    if (currentIndex > 0) {
      onChange({ ...options, cursor: cursors[currentIndex - 1] });
    }
  }, [onChange, options, cursors, currentIndex]);
  const filtered = !!priority || !!q || !!status || !!category;
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
  const first = useCallback(() => onChange(options), [onChange, options]);
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
  if (access.pending) {
    return <LoadingState label="Loading access…" rows={2} />;
  }
  if (!access.canView) {
    return <p role="alert">Work orders are unavailable.</p>;
  }
  return (
    <PageLayout className="space-y-6">
      <PageHeader
        actions={
          access.canCreate ? (
            <Link
              className={buttonVariants()}
              params={{ estateId }}
              to="/estates/$estateId/work-orders/new"
            >
              <Plus aria-hidden="true" />
              Create work order
            </Link>
          ) : null
        }
        description={access.estateName}
        title="Work orders"
      />
      <WorkOrderFilters
        filters={filters}
        key={JSON.stringify(filters)}
        onChange={changeFilters}
      />
      {orders.isPending ? (
        <LoadingState label="Loading work orders…" variant="table" />
      ) : null}
      {orders.isError ? (
        <p role="alert">
          Unable to load work orders.{" "}
          <Button onClick={retry} variant="outline">
            Retry
          </Button>
        </p>
      ) : null}
      {orders.data && !orders.isError ? (
        <>
          {orders.data.items.length === 0 ? (
            <WorkOrderEmptyState
              canCreate={access.canCreate}
              estateId={estateId}
              filtered={filtered}
              onClear={clearFilters}
            />
          ) : (
            <WorkOrderTable
              descending={descending}
              estateId={estateId}
              loading={orders.isFetching}
              onSort={changeSort}
              orders={orders.data.items}
              sortBy={sortBy ?? "CREATED_AT"}
            />
          )}
          <WorkOrderPages
            canPrevious={canPrevious}
            count={orders.data.items.length}
            cursor={cursor}
            hasNext={!!orders.data.nextCursor}
            onFirst={first}
            onNext={next}
            onPrevious={previous}
            pending={orders.isPlaceholderData}
          />
        </>
      ) : null}
    </PageLayout>
  );
}

function WorkOrderEmptyState({
  filtered,
  canCreate,
  estateId,
  onClear,
}: {
  filtered: boolean;
  canCreate: boolean;
  estateId: string;
  onClear: () => void;
}) {
  if (filtered) {
    return (
      <EmptyState
        action={
          <Button onClick={onClear} variant="outline">
            Clear filters
          </Button>
        }
        description="Try different filters, or clear them."
        icon={Wrench}
        title="No matching work orders"
      />
    );
  }
  return (
    <EmptyState
      action={
        canCreate ? (
          <Link
            className={buttonVariants()}
            params={{ estateId }}
            to="/estates/$estateId/work-orders/new"
          >
            <Plus aria-hidden="true" />
            Create work order
          </Link>
        ) : undefined
      }
      description="Saved work orders will appear here."
      icon={Wrench}
      title="No work orders yet"
    />
  );
}

function WorkOrderPages({
  count,
  cursor,
  canPrevious,
  hasNext,
  pending,
  onFirst,
  onPrevious,
  onNext,
}: {
  count: number;
  cursor?: string;
  canPrevious: boolean;
  hasNext: boolean;
  pending: boolean;
  onFirst: () => void;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <nav
      aria-label="Work-order pages"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-muted-foreground text-sm">
        {count} {count === 1 ? "work order" : "work orders"} on this page
      </p>
      <div className="flex flex-wrap gap-2">
        {cursor ? (
          <Button disabled={pending} onClick={onFirst} variant="outline">
            First page
          </Button>
        ) : null}
        {canPrevious ? (
          <Button disabled={pending} onClick={onPrevious} variant="outline">
            Previous
          </Button>
        ) : null}
        {hasNext ? (
          <Button disabled={pending} onClick={onNext} variant="outline">
            Next
          </Button>
        ) : null}
      </div>
    </nav>
  );
}
