import type { components } from "@proj/api/schema";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { LoadMore } from "@/components/table/load-more";
import { Pagination } from "@/components/table/pagination";
import type { PagedList } from "@/lib/infinite-list";
import type { WorkOrderListSearch } from "@/lib/work-orders";
import { WorkOrderEmptyState } from "@/routes/_auth/estates/$estateId/work-orders/-components/work-order-list-page/work-order-empty-state";
import { WorkOrderTable } from "@/routes/_auth/estates/$estateId/work-orders/-components/work-order-list-page/work-order-table";

export function WorkOrderListResults({
  canCreate,
  canPrevious,
  descending,
  estateId,
  filtered,
  onClear,
  onNext,
  onPrevious,
  onRetry,
  onSort,
  orders,
  sortBy,
}: {
  canCreate: boolean;
  canPrevious: boolean;
  descending: boolean;
  estateId: string;
  filtered: boolean;
  onClear: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onRetry: () => void;
  onSort: (column: NonNullable<WorkOrderListSearch["sortBy"]>) => void;
  orders: PagedList<components["schemas"]["WorkOrderPageResponse"]>;
  sortBy: NonNullable<WorkOrderListSearch["sortBy"]>;
}) {
  return (
    <>
      {orders.isPending ? (
        <LoadingState label="Loading work orders…" variant="table" />
      ) : null}
      {orders.isError ? (
        <ErrorState
          message="Couldn't load work orders. Try again."
          onRetry={onRetry}
        />
      ) : null}
      {orders.data && !orders.isError ? (
        <>
          {orders.data.items.length === 0 ? (
            <WorkOrderEmptyState
              canCreate={canCreate}
              filtered={filtered}
              onClear={onClear}
            />
          ) : (
            <WorkOrderTable
              descending={descending}
              estateId={estateId}
              loading={orders.isFetching}
              onSort={onSort}
              orders={orders.data.items}
              sortBy={sortBy}
            />
          )}
          {orders.more ? (
            <LoadMore {...orders.more} />
          ) : (
            <Pagination
              canNext={!!orders.data.nextCursor}
              canPrevious={canPrevious}
              disabled={orders.isPlaceholderData}
              label="Work order pages"
              onNext={onNext}
              onPrevious={onPrevious}
              summary={`${orders.data.items.length} ${
                orders.data.items.length === 1 ? "work order" : "work orders"
              } on this page`}
            />
          )}
        </>
      ) : null}
    </>
  );
}
