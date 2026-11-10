import { Button } from "@proj/ui/components/button";
import { Field, FieldLabel } from "@proj/ui/components/field";
import { Input } from "@proj/ui/components/input";
import { Link } from "@tanstack/react-router";
import { ChevronRight, ClipboardList, Layers, Search } from "lucide-react";
import { type ChangeEvent, type FormEvent, useCallback, useState } from "react";
import { FilterBar, useFilterPanel } from "@/components/filters/filter-bar";
import { ListRow, ListRows } from "@/components/list/list-row";
import { ListPageHeader } from "@/components/page/list-page-header";
import { PageLayout } from "@/components/page/page-layout";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { LoadMore } from "@/components/table/load-more";
import { Pagination } from "@/components/table/pagination";
import { asPagedList } from "@/lib/infinite-list";
import {
  useInspectionAccess,
  useInspectionAssetFeed,
  useInspectionAssets,
} from "@/lib/inspections";
import { useMobile } from "@/lib/use-mobile";
import { AssetViewsNav } from "@/routes/_auth/estates/$estateId/assets/-components/asset-views-nav";

export function InspectionAssetList({ estateId }: { estateId: string }) {
  const access = useInspectionAccess(estateId);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const cursor = cursors.at(-1);
  const mobile = useMobile();
  const paged = useInspectionAssets(estateId, query, cursor, !mobile);
  const feed = asPagedList(useInspectionAssetFeed(estateId, query, mobile));
  const assets = mobile ? feed : paged;
  const panel = useFilterPanel(0);
  const find = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setQuery(search.trim());
      setCursors([undefined]);
    },
    [search]
  );
  const changeSearch = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value),
    []
  );
  const retry = useCallback(() => assets.refetch(), [assets.refetch]);
  const nextCursor = assets.data?.nextCursor;
  const next = useCallback(() => {
    if (nextCursor) {
      setCursors((current) => [...current, nextCursor]);
    }
  }, [nextCursor]);
  const previous = useCallback(
    () =>
      setCursors((current) =>
        current.length > 1 ? current.slice(0, -1) : current
      ),
    []
  );
  if (access.pending) {
    return <LoadingState label="Loading access…" rows={2} />;
  }
  if (!access.canView) {
    return <p role="alert">Inspection assets are unavailable.</p>;
  }
  return (
    <PageLayout className="space-y-6">
      <ListPageHeader
        description="Asset context and inspections"
        filters={{ activeCount: query ? 1 : 0, ...panel.toggleProps }}
        icon={Layers}
        title="Assets"
      />
      <AssetViewsNav estateId={estateId} />
      <FilterBar
        activeCount={query ? 1 : 0}
        label="Search assets"
        {...panel.barProps}
        search={
          <form className="flex items-end gap-3" onSubmit={find}>
            <Field className="flex-1">
              <FieldLabel htmlFor="inspection-asset-search">
                Search assets
              </FieldLabel>
              <Input
                id="inspection-asset-search"
                maxLength={200}
                onChange={changeSearch}
                type="search"
                value={search}
              />
            </Field>
            <Button type="submit" variant="outline">
              <Search aria-hidden="true" />
              Search
            </Button>
          </form>
        }
      />
      {assets.isPending ? (
        <LoadingState label="Loading assets…" variant="cards" />
      ) : null}
      {assets.isError ? (
        <ErrorState
          message={
            assets.error?.message ?? "Inspection assets are unavailable."
          }
          onRetry={retry}
          retryLabel="Retry assets"
        />
      ) : null}
      {assets.data?.items.length ? (
        <ListRows label="Assets to inspect">
          {assets.data.items.map((asset) => (
            <ListRow
              icon={ClipboardList}
              key={asset.id}
              meta={`${asset.reference} · ${asset.locationPath}`}
              render={
                <Link
                  aria-label={`${asset.reference} · ${asset.name}`}
                  params={{ estateId, assetId: asset.id }}
                  to="/estates/$estateId/assets/$assetId"
                />
              }
              title={asset.name}
              trailing={
                <ChevronRight
                  aria-hidden="true"
                  className="text-muted-foreground size-4"
                />
              }
            >
              <p className="text-muted-foreground text-xs">
                {asset.assetActive && asset.estateActive && asset.locationActive
                  ? "Available for inspection"
                  : "Past record only · can't record a new inspection"}
              </p>
            </ListRow>
          ))}
        </ListRows>
      ) : null}
      {assets.data?.items.length === 0 ? (
        <EmptyState
          description={query ? "Try a different name or reference" : undefined}
          icon={ClipboardList}
          title={query ? "No matching assets" : "No assets yet"}
        />
      ) : null}
      {mobile && assets.data?.items.length ? <LoadMore {...feed.more} /> : null}
      {!mobile && (nextCursor || cursors.length > 1) ? (
        <Pagination
          canNext={Boolean(nextCursor)}
          canPrevious={cursors.length > 1}
          disabled={assets.isFetching}
          label="Asset pages"
          onNext={next}
          onPrevious={previous}
        />
      ) : null}
    </PageLayout>
  );
}
