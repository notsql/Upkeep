import { Building2 } from "lucide-react";
import { type ChangeEvent, useCallback } from "react";
import { ErrorState } from "@/components/error-state";
import { useFilterPanel } from "@/components/filter-bar";
import { ListPageHeader } from "@/components/list-page-header";
import { LoadingState } from "@/components/loading-state";
import { PageLayout } from "@/components/page-layout";
import { type EstateStatus, useEstateList } from "@/lib/estates";
import { EstateCard } from "@/routes/_auth/estates/-components/estate-card";
import type {
  EstateAccess,
  EstateDirectoryFilters,
} from "@/routes/_auth/estates/-components/estate-directory-filters";
import { EstateEmptyState } from "@/routes/_auth/estates/-components/estate-empty-state";
import { EstateFilterToolbar } from "@/routes/_auth/estates/-components/estate-filter-toolbar";
import { InvitationAcceptance } from "@/routes/_auth/estates/-components/invitation-acceptance";
import { PendingInvitations } from "@/routes/_auth/estates/-components/pending-invitations";

function emptyMessageFor(
  status: EstateStatus,
  hasSearchOrAccess: boolean
): string {
  if (hasSearchOrAccess) {
    return "Try another search or access filter";
  }
  if (status === "ALL") {
    return "No estates yet";
  }
  return `No ${status.toLowerCase()} estates`;
}

export function EstateListPage({
  filters,
  onFiltersChange,
}: {
  filters: EstateDirectoryFilters;
  onFiltersChange: (filters: EstateDirectoryFilters) => void;
}) {
  const status = filters.status ?? "ACTIVE";
  const access = filters.access ?? "ALL";
  const search = (filters.q ?? "").trim().toLowerCase();
  const estates = useEstateList(status);
  const visible = estates.data?.filter(
    (estate) =>
      (access === "ALL" ||
        (access === "OWNED" ? estate.owned : !estate.owned)) &&
      [estate.name, estate.code, estate.address].some((value) =>
        value.toLowerCase().includes(search)
      )
  );
  const hasSearchOrAccess = Boolean(search) || access !== "ALL";
  const retry = useCallback(() => estates.refetch(), [estates.refetch]);
  const changeSearch = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      onFiltersChange({ ...filters, q: event.target.value || undefined }),
    [onFiltersChange, filters]
  );
  const changeStatus = useCallback(
    (value: EstateStatus | null) => {
      if (value) {
        onFiltersChange({ ...filters, status: value });
      }
    },
    [onFiltersChange, filters]
  );
  const changeAccess = useCallback(
    (value: EstateAccess | null) => {
      if (value) {
        onFiltersChange({ ...filters, access: value });
      }
    },
    [onFiltersChange, filters]
  );
  const clearFilters = useCallback(
    () => onFiltersChange({}),
    [onFiltersChange]
  );
  const emptyMessage = emptyMessageFor(status, hasSearchOrAccess);
  const activeCount =
    (search ? 1 : 0) +
    (access === "ALL" ? 0 : 1) +
    (status === "ACTIVE" ? 0 : 1);
  const filtersActive = activeCount > 0;
  const count = visible?.length ?? 0;
  const panel = useFilterPanel(activeCount);

  return (
    <PageLayout>
      <InvitationAcceptance />
      <PendingInvitations />
      <ListPageHeader
        create={{ to: "/estates/new" }}
        description="Estates you own or can access"
        filters={{ activeCount, ...panel.toggleProps }}
        icon={Building2}
        title="Estates"
      />
      <EstateFilterToolbar
        {...panel.barProps}
        access={access}
        activeCount={activeCount}
        changeAccess={changeAccess}
        changeSearch={changeSearch}
        changeStatus={changeStatus}
        clearFilters={clearFilters}
        count={count}
        filters={filters}
        showCount={Boolean(visible)}
        status={status}
      />
      {estates.isPending ? (
        <LoadingState label="Loading estates…" variant="cards" />
      ) : null}
      {estates.error ? (
        <ErrorState
          message={estates.error.message}
          onRetry={retry}
          retryLabel="Retry estates"
        />
      ) : null}
      {visible?.length === 0 ? (
        <EstateEmptyState
          emptyMessage={emptyMessage}
          filtersActive={filtersActive}
          onClear={clearFilters}
        />
      ) : null}
      {count > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible?.map((estate) => (
            <li key={estate.id}>
              <EstateCard estate={estate} />
            </li>
          ))}
        </ul>
      ) : null}
    </PageLayout>
  );
}
