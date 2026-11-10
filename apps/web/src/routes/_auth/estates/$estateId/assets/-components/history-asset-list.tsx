import { Badge } from "@proj/ui/components/badge";
import { Button } from "@proj/ui/components/button";
import { Input } from "@proj/ui/components/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemSeparator,
  ItemTitle,
} from "@proj/ui/components/item";
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
import { LoadMore } from "@/components/table/load-more";
import {
  type HistoryAssetFilters,
  useHistoryAssetFeed,
  useHistoryAssets,
} from "@/lib/asset-history";
import { asPagedList } from "@/lib/infinite-list";
import { useMobile } from "@/lib/use-mobile";

type HistoryAsset = NonNullable<
  ReturnType<typeof useHistoryAssets>["data"]
>["items"][number];

export function HistoryAssetList({
  estateId,
  filters,
  onFiltersChange,
}: {
  estateId: string;
  filters: HistoryAssetFilters;
  onFiltersChange: (filters: HistoryAssetFilters) => void;
}) {
  const mobile = useMobile();
  const paged = useHistoryAssets(estateId, filters, !mobile);
  const feed = asPagedList(
    useHistoryAssetFeed(
      estateId,
      { q: filters.q, status: filters.status },
      mobile
    )
  );
  const assets = mobile ? feed : paged;
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
        description="Browse assets and their recorded history, including assets out of use."
        icon={History}
        title="Assets"
      />
      <div className="flex flex-wrap items-end gap-4">
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
          <Select onValueChange={changeStatus} value={filters.status ?? "ALL"}>
            <SelectTrigger aria-labelledby="history-asset-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All assets</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Out of use</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
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
      {items?.length && mobile ? (
        <>
          <ul aria-label="Assets" className="flex flex-col">
            {items.map((asset, index) => (
              <li key={asset.id}>
                {index > 0 ? <ItemSeparator /> : null}
                <HistoryAssetItem asset={asset} estateId={estateId} />
              </li>
            ))}
          </ul>
          <LoadMore {...feed.more} />
        </>
      ) : null}
      {items?.length && !mobile ? (
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
                  <Badge variant="secondary">{statusLabel(asset)}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
      {mobile ? null : (
        <HistoryPaging
          onFirst={filters.cursor ? first : undefined}
          onNext={assets.data?.nextCursor ? next : undefined}
        />
      )}
    </PageLayout>
  );
}

function HistoryPaging({
  onFirst,
  onNext,
}: {
  onFirst?: () => void;
  onNext?: () => void;
}) {
  return (
    <div className="flex gap-3">
      {onFirst ? (
        <Button onClick={onFirst} variant="outline">
          First page
        </Button>
      ) : null}
      {onNext ? (
        <Button onClick={onNext} variant="outline">
          Next page
        </Button>
      ) : null}
    </div>
  );
}

function statusLabel(asset: HistoryAsset): string {
  return asset.status === "RETIRED" ? "Out of use" : "Active";
}

function HistoryAssetItem({
  asset,
  estateId,
}: {
  asset: HistoryAsset;
  estateId: string;
}) {
  const details = [asset.reference, asset.category, asset.locationPath]
    .filter(Boolean)
    .join(" · ");
  return (
    <Item
      render={
        <Link
          aria-label={`${asset.name} (${asset.reference})`}
          params={{ estateId, assetId: asset.id }}
          to="/estates/$estateId/assets/$assetId"
        />
      }
      size="sm"
    >
      <ItemContent className="min-w-0">
        <ItemTitle className="line-clamp-none [overflow-wrap:anywhere]">
          {asset.name}
        </ItemTitle>
        <ItemDescription className="text-xs">{details}</ItemDescription>
      </ItemContent>
      <ItemActions className="self-start">
        <Badge variant="secondary">{statusLabel(asset)}</Badge>
      </ItemActions>
    </Item>
  );
}
