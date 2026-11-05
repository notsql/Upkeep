import { Button } from "@proj/ui/components/button";
import { Card, CardContent } from "@proj/ui/components/card";
import { Field, FieldLabel } from "@proj/ui/components/field";
import { Input } from "@proj/ui/components/input";
import { Link } from "@tanstack/react-router";
import { Boxes } from "lucide-react";
import { type ChangeEvent, type FormEvent, useCallback, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { PageLayout } from "@/components/page-layout";
import { useInspectionAccess, useInspectionAssets } from "@/lib/inspections";

export function InspectionAssetList({ estateId }: { estateId: string }) {
  const access = useInspectionAccess(estateId);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState<string>();
  const assets = useInspectionAssets(estateId, query, cursor);
  const find = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setQuery(search.trim());
      setCursor(undefined);
    },
    [search]
  );
  const changeSearch = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value),
    []
  );
  const retry = useCallback(() => assets.refetch(), [assets.refetch]);
  const first = useCallback(() => setCursor(undefined), []);
  const next = useCallback(
    () => setCursor(assets.data?.nextCursor ?? undefined),
    [assets.data?.nextCursor]
  );
  if (access.pending) {
    return <LoadingState label="Loading access…" rows={2} />;
  }
  if (!access.canView) {
    return <p role="alert">Inspection assets are unavailable.</p>;
  }
  return (
    <PageLayout className="space-y-6">
      <PageHeader
        description="Browse asset context and record inspections."
        title="Assets"
      />
      <FilterBar
        label="Search assets"
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
            <Button type="submit">Search</Button>
          </form>
        }
      />
      {assets.isPending ? (
        <LoadingState label="Loading assets…" variant="cards" />
      ) : null}
      {assets.isError ? (
        <div>
          <p role="alert">{assets.error.message}</p>
          <Button onClick={retry} variant="outline">
            Retry assets
          </Button>
        </div>
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
          description={query ? "Try a different name or reference." : undefined}
          icon={Boxes}
          title={query ? "No matching assets" : "No assets yet"}
        />
      ) : null}
      <div className="flex gap-3">
        {cursor ? (
          <Button onClick={first} variant="outline">
            First page
          </Button>
        ) : null}
        {assets.data?.nextCursor ? (
          <Button onClick={next} variant="outline">
            Next
          </Button>
        ) : null}
      </div>
    </PageLayout>
  );
}
