import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { Pagination } from "@/components/pagination";
import type { useWorkOrderList, WorkOrderListSearch } from "@/lib/work-orders";
import { WorkOrderEmptyState } from "./work-order-empty-state";
import { WorkOrderTable } from "./work-order-table";

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
  orders: ReturnType<typeof useWorkOrderList>;
  sortBy: NonNullable<WorkOrderListSearch["sortBy"]>;
}) {
  return (
    <>
      {orders.isPending ? (
        <LoadingState label="Loading work orders…" variant="table" />
      ) : null}
      {orders.isError ? (
        <ErrorState message="Unable to load work orders" onRetry={onRetry} />
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
        </>
      ) : null}
    </>
  );
}
