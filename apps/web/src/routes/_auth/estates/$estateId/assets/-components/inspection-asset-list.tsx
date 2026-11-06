import { Button } from "@proj/ui/components/button";
import { Card, CardContent } from "@proj/ui/components/card";
import { Field, FieldLabel } from "@proj/ui/components/field";
import { Input } from "@proj/ui/components/input";
import { Link } from "@tanstack/react-router";
import { Layers, Search } from "lucide-react";
import { type ChangeEvent, type FormEvent, useCallback, useState } from "react";
import { FilterBar, useFilterPanel } from "@/components/filters/filter-bar";
import { ListPageHeader } from "@/components/page/list-page-header";
import { PageLayout } from "@/components/page/page-layout";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { Pagination } from "@/components/table/pagination";
import { useInspectionAccess, useInspectionAssets } from "@/lib/inspections";

export function InspectionAssetList({ estateId }: { estateId: string }) {
  const access = useInspectionAccess(estateId);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const cursor = cursors.at(-1);
  const assets = useInspectionAssets(estateId, query, cursor);
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
          message={assets.error.message}
          onRetry={retry}
          retryLabel="Retry assets"
        />
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        {assets.data?.items.map((asset) => (
          <Card key={asset.id}>
            <CardContent className="space-y-2 pt-5">
              <Link
                className="font-semibold underline"
                params={{ estateId, assetId: asset.id }}
                to="/estates/$estateId/assets/$assetId"
              >
                {asset.reference} · {asset.name}
              </Link>
              <p>{asset.locationPath}</p>
              <p className="text-muted-foreground text-sm">
                {asset.assetActive && asset.estateActive && asset.locationActive
                  ? "Available for inspection"
                  : "Historical context · inspection recording unavailable"}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      {assets.data?.items.length === 0 ? (
        <EmptyState
          description={query ? "Try a different name or reference" : undefined}
          title={query ? "No matching assets" : "No assets yet"}
        />
      ) : null}
      {nextCursor || cursors.length > 1 ? (
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
