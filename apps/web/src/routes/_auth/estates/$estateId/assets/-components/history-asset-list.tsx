import { Badge } from "@proj/ui/components/badge";
import { Button } from "@proj/ui/components/button";
import { Card, CardContent } from "@proj/ui/components/card";
import { Input } from "@proj/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import { Link } from "@tanstack/react-router";
import { History } from "lucide-react";
import { type ChangeEvent, useCallback, useEffect, useState } from "react";
import { ListPageHeader } from "@/components/page/list-page-header";
import { PageLayout } from "@/components/page/page-layout";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import {
  type HistoryAssetFilters,
  useHistoryAssets,
} from "@/lib/asset-history";

export function HistoryAssetList({
  estateId,
  filters,
  onFiltersChange,
}: {
  estateId: string;
  filters: HistoryAssetFilters;
  onFiltersChange: (filters: HistoryAssetFilters) => void;
}) {
  const assets = useHistoryAssets(estateId, filters);
  const [search, setSearch] = useState(filters.q ?? "");
  useEffect(() => setSearch(filters.q ?? ""), [filters.q]);
  useEffect(() => {
    if (search.trim() === (filters.q ?? "")) {
      return;
    }
    const timer = setTimeout(
      () =>
        onFiltersChange({
          q: search.trim() || undefined,
          status: filters.status,
        }),
      300
    );
    return () => clearTimeout(timer);
  }, [search, filters.q, filters.status, onFiltersChange]);
  const changeSearch = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value),
    []
  );
  const changeStatus = useCallback(
    (value: string | null) => {
      if (value === "ALL" || value === "ACTIVE" || value === "INACTIVE") {
        onFiltersChange({ q: filters.q, status: value });
      }
    },
    [filters.q, onFiltersChange]
  );
  const first = useCallback(
    () => onFiltersChange({ q: filters.q, status: filters.status }),
    [filters.q, filters.status, onFiltersChange]
  );
  const next = useCallback(
    () =>
      onFiltersChange({
        ...filters,
        cursor: assets.data?.nextCursor ?? undefined,
      }),
    [filters, assets.data?.nextCursor, onFiltersChange]
  );
  const retry = useCallback(() => {
    assets.refetch();
  }, [assets.refetch]);
  const items = assets.data?.items;
  return (
    <PageLayout className="space-y-5">
      <ListPageHeader
        description="Browse assets and their recorded history, including retired equipment."
        icon={History}
        title="Assets"
      />
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 pt-6">
          <div className="min-w-0 flex-1 space-y-2">
            <label htmlFor="history-asset-search">Search assets</label>
            <Input
              id="history-asset-search"
              maxLength={255}
              onChange={changeSearch}
              placeholder="Reference or name"
              value={search}
            />
          </div>
          <div className="space-y-2">
            <span id="history-asset-status">Status</span>
            <Select
              onValueChange={changeStatus}
              value={filters.status ?? "ALL"}
            >
              <SelectTrigger aria-labelledby="history-asset-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All assets</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Retired</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      {assets.isPending ? (
        <LoadingState label="Loading assets…" rows={3} />
      ) : null}
      {assets.error ? (
        <ErrorState message={assets.error.message} onRetry={retry} />
      ) : null}
      {items?.length === 0 ? (
        <EmptyState
          action={
            filters.cursor ? (
              <Button onClick={first} variant="outline">
                First page
              </Button>
            ) : undefined
          }
          icon={History}
          title={
            filters.q ||
            filters.status === "ACTIVE" ||
            filters.status === "INACTIVE"
              ? "No matching assets"
              : "No assets yet"
          }
        />
      ) : null}
      {items?.length ? (
        <Card>
          <CardContent>
            <Table aria-label="Assets">
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((asset) => (
                  <TableRow key={asset.id}>
                    <TableCell>{asset.reference}</TableCell>
                    <TableCell>
                      <Link
                        className="underline"
                        params={{ estateId, assetId: asset.id }}
                        to="/estates/$estateId/assets/$assetId"
                      >
                        {asset.name}
                      </Link>
                    </TableCell>
                    <TableCell>{asset.category}</TableCell>
                    <TableCell className="whitespace-normal">
                      {asset.locationPath}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {asset.status === "RETIRED" ? "Retired" : "Active"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
      <div className="flex gap-3">
        {filters.cursor ? (
          <Button onClick={first} variant="outline">
            First page
          </Button>
        ) : null}
        {assets.data?.nextCursor ? (
          <Button onClick={next} variant="outline">
            Next page
          </Button>
        ) : null}
      </div>
    </PageLayout>
  );
}
