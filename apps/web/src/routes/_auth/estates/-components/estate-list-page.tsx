import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Badge } from "@proj/ui/components/badge";
import { Button, buttonVariants } from "@proj/ui/components/button";
import { Card } from "@proj/ui/components/card";
import { Field } from "@proj/ui/components/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@proj/ui/components/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";
import { Link } from "@tanstack/react-router";
import { Building2, ChevronRight, MapPin, Plus, Search } from "lucide-react";
import { type ChangeEvent, useCallback } from "react";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import { LifecycleStatusBadge } from "@/components/lifecycle-status-badge";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { PageLayout } from "@/components/page-layout";
import { type EstateStatus, formatMcst, useEstateList } from "@/lib/estates";
import type {
  EstateAccess,
  EstateDirectoryFilters,
} from "@/routes/_auth/estates/-components/estate-directory-filters";
import { InvitationAcceptance } from "@/routes/_auth/estates/-components/invitation-acceptance";
import { PendingInvitations } from "@/routes/_auth/estates/-components/pending-invitations";

const statusItems: { value: EstateStatus; label: string }[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "ALL", label: "All" },
];

const accessItems: { value: EstateAccess; label: string }[] = [
  { value: "ALL", label: "All access" },
  { value: "OWNED", label: "Owner" },
  { value: "SHARED", label: "Shared with you" },
];

const monogramColours = [
  "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  "bg-teal-500/15 text-teal-700 dark:text-teal-300",
];

function monogramColour(id: string): string {
  let hash = 0;
  for (const char of id) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 2_147_483_647;
  }
  return monogramColours[hash % monogramColours.length] ?? "";
}

const whitespace = /\s+/u;

type EstateSummary = NonNullable<
  ReturnType<typeof useEstateList>["data"]
>[number];

function initials(name: string): string {
  const words = name.trim().split(whitespace).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

function emptyMessageFor(
  status: EstateStatus,
  hasSearchOrAccess: boolean
): string {
  if (hasSearchOrAccess) {
    return "No estates match your search or access filter.";
  }
  if (status === "ALL") {
    return "No estates yet. Create your first estate to get started.";
  }
  return `No ${status.toLowerCase()} estates.`;
}

function EstateFilterToolbar({
  access,
  changeAccess,
  changeSearch,
  changeStatus,
  clearFilters,
  count,
  filters,
  showClear,
  showCount,
  status,
}: {
  access: EstateAccess;
  changeAccess: (value: EstateAccess | null) => void;
  changeSearch: (event: ChangeEvent<HTMLInputElement>) => void;
  changeStatus: (value: EstateStatus | null) => void;
  clearFilters: () => void;
  count: number;
  filters: EstateDirectoryFilters;
  showClear: boolean;
  showCount: boolean;
  status: EstateStatus;
}) {
  return (
    <div className="mb-6">
      <FilterBar
        actions={
          <>
            {showClear ? (
              <Button onClick={clearFilters} variant="ghost">
                Clear filters
              </Button>
            ) : null}
            {showCount ? (
              <p className="text-muted-foreground text-sm tabular-nums">
                {count} {count === 1 ? "estate" : "estates"}
              </p>
            ) : null}
          </>
        }
        label="Filter estates"
        search={
          <InputGroup>
            <InputGroupAddon>
              <Search aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              aria-label="Search estates"
              onChange={changeSearch}
              placeholder="Search by name, MCST number or address"
              type="search"
              value={filters.q ?? ""}
            />
          </InputGroup>
        }
      >
        <Field className="w-full sm:w-48">
          <Select
            items={statusItems}
            onValueChange={changeStatus}
            value={status}
          >
            <SelectTrigger aria-label="Status" className="w-full">
              <SelectValue className="min-w-0 truncate" />
            </SelectTrigger>
            <SelectContent>
              {statusItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field className="w-full sm:w-48">
          <Select
            items={accessItems}
            onValueChange={changeAccess}
            value={access}
          >
            <SelectTrigger aria-label="Access" className="w-full">
              <SelectValue className="min-w-0 truncate" />
            </SelectTrigger>
            <SelectContent>
              {accessItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </FilterBar>
    </div>
  );
}

function EstateEmptyState({
  clearFilters,
  emptyMessage,
  filtersActive,
}: {
  clearFilters: () => void;
  emptyMessage: string;
  filtersActive: boolean;
}) {
  return (
    <EmptyState
      action={
        filtersActive ? (
          <Button onClick={clearFilters} variant="outline">
            Clear filters
          </Button>
        ) : (
          <Link className={buttonVariants()} to="/estates/new">
            <Plus aria-hidden="true" />
            Create estate
          </Link>
        )
      }
      description={
        filtersActive
          ? emptyMessage
          : "Create an estate to start tracking its assets, readings and work orders."
      }
      icon={Building2}
      title={filtersActive ? "No matching estates" : emptyMessage}
    />
  );
}

function EstateCard({ estate }: { estate: EstateSummary }) {
  return (
    <Link
      aria-label={`${estate.name} (${formatMcst(estate.code)})`}
      className="group focus-visible:ring-ring block h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      params={{ estateId: estate.id }}
      to="/estates/$estateId"
    >
      <Card className="group-hover:ring-primary/40 group-focus-visible:ring-primary/40 h-full gap-4 px-5 text-sm transition-[box-shadow] group-hover:shadow-md motion-reduce:transition-none">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className={`flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold ${monogramColour(estate.id)}`}
          >
            {initials(estate.name)}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-semibold tracking-tight">
              {estate.name}
            </h2>
            <p className="text-muted-foreground font-mono text-xs">
              {formatMcst(estate.code)}
            </p>
          </div>
          <ChevronRight
            aria-hidden="true"
            className="text-muted-foreground size-4 shrink-0 opacity-0 transition-[opacity,transform] group-hover:translate-x-0.5 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
          />
        </div>
        <p className="text-muted-foreground flex min-w-0 items-start gap-1.5">
          <MapPin aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          <span className="line-clamp-2">
            {estate.address}, {estate.postalCode}
          </span>
        </p>
        <div className="mt-auto flex flex-wrap gap-2">
          <Badge variant={estate.owned ? "secondary" : "outline"}>
            {estate.owned ? "Owner" : "Shared with you"}
          </Badge>
          <LifecycleStatusBadge
            inactive={Boolean(estate.deactivatedAt)}
            inactiveLabel="Inactive"
          />
        </div>
      </Card>
    </Link>
  );
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
  const filtersActive = hasSearchOrAccess || status !== "ACTIVE";
  const count = visible?.length ?? 0;

  return (
    <PageLayout>
      <InvitationAcceptance />
      <PendingInvitations />
      <PageHeader
        actions={
          <Link className={buttonVariants()} to="/estates/new">
            <Plus aria-hidden="true" />
            Create estate
          </Link>
        }
        description="Estates you own or have access to."
        title="Estates"
      />
      <EstateFilterToolbar
        access={access}
        changeAccess={changeAccess}
        changeSearch={changeSearch}
        changeStatus={changeStatus}
        clearFilters={clearFilters}
        count={count}
        filters={filters}
        showClear={filtersActive && count > 0}
        showCount={Boolean(visible)}
        status={status}
      />
      {estates.isPending ? (
        <LoadingState label="Loading estates…" variant="cards" />
      ) : null}
      {estates.error ? (
        <Alert variant="destructive">
          <AlertDescription>
            {estates.error.message}
            <Button onClick={retry} variant="outline">
              Retry estates
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {visible?.length === 0 ? (
        <EstateEmptyState
          clearFilters={clearFilters}
          emptyMessage={emptyMessage}
          filtersActive={filtersActive}
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
