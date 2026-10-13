import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Badge } from "@proj/ui/components/badge";
import { Button, buttonVariants } from "@proj/ui/components/button";
import { Card } from "@proj/ui/components/card";
import { Empty } from "@proj/ui/components/empty";
import { Input } from "@proj/ui/components/input";
import { Label } from "@proj/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";
import { Link } from "@tanstack/react-router";
import { type ChangeEvent, useCallback } from "react";
import { LifecycleStatusBadge } from "@/components/lifecycle-status-badge";
import { PageHeader } from "@/components/page-header";
import { type EstateStatus, useEstateList } from "@/lib/estates";
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
  let emptyMessage = `No ${status.toLowerCase()} estates.`;
  if (hasSearchOrAccess) {
    emptyMessage = "No estates match your search or access filter.";
  } else if (status === "ALL") {
    emptyMessage = "No estates yet. Create your first estate to get started.";
  }

  return (
    <main className="page-layout">
      <PageHeader
        actions={
          <Link className={buttonVariants()} to="/estates/new">
            Create estate
          </Link>
        }
        description="Estates you own or have access to."
        title="Estates"
      />
      <InvitationAcceptance />
      <PendingInvitations />
      <div className="my-5 grid grid-cols-2 items-end gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <div className="col-span-2 flex min-w-0 flex-col gap-2 sm:col-span-1">
          <Label className="text-sm leading-5" htmlFor="estate-search">
            Search estates
          </Label>
          <Input
            className="h-11"
            id="estate-search"
            onChange={changeSearch}
            placeholder="Name, code or address"
            type="search"
            value={filters.q ?? ""}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <Label className="text-sm leading-5" htmlFor="estate-status">
            Status
          </Label>
          <Select
            items={statusItems}
            onValueChange={changeStatus}
            value={status}
          >
            <SelectTrigger className="h-11 w-full min-w-0" id="estate-status">
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
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <Label className="text-sm leading-5" htmlFor="estate-access">
            Access
          </Label>
          <Select
            items={accessItems}
            onValueChange={changeAccess}
            value={access}
          >
            <SelectTrigger className="h-11 w-full min-w-0" id="estate-access">
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
        </div>
      </div>
      {hasSearchOrAccess || status !== "ACTIVE" ? (
        <Button className="mb-4" onClick={clearFilters} variant="outline">
          Clear filters
        </Button>
      ) : null}
      {estates.isPending ? <p aria-live="polite">Loading estates…</p> : null}
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
        <Empty className="mb-6 border border-dashed bg-card" role="status">
          {emptyMessage}
        </Empty>
      ) : null}
      <ul className="grid gap-4 sm:grid-cols-2">
        {visible?.map((estate) => (
          <li key={estate.id}>
            <Link
              aria-label={`${estate.name} (${estate.code})`}
              className="group block h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              params={{ estateId: estate.id }}
              to="/estates/$estateId"
            >
              <Card className="h-full gap-0 px-5 text-sm transition-[background-color,box-shadow] group-hover:bg-accent/40 group-hover:shadow-sm group-hover:ring-primary/40 group-focus-visible:bg-accent/40 group-focus-visible:ring-primary/40 group-active:bg-accent group-active:ring-primary/40 motion-reduce:transition-none">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2 className="break-words font-medium text-lg underline-offset-4 group-hover:underline">
                    {estate.name}
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      {estate.owned ? "Owner" : "Shared with you"}
                    </Badge>
                    <LifecycleStatusBadge
                      inactive={Boolean(estate.deactivatedAt)}
                      inactiveLabel="Inactive"
                    />
                  </div>
                </div>
                <p className="mt-2 text-muted-foreground text-sm">
                  {estate.code}
                </p>
                <p className="mt-3 text-sm">
                  {estate.address}, {estate.postalCode}
                </p>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
