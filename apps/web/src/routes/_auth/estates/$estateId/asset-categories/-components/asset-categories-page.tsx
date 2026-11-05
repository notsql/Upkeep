import { Badge } from "@proj/ui/components/badge";
import { Button, buttonVariants } from "@proj/ui/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import { Link } from "@tanstack/react-router";
import { SearchX, Tags } from "lucide-react";
import { type ReactNode, useCallback, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { IntervalBadge } from "@/components/interval-badge";
import { LoadingState } from "@/components/loading-state";
import { ListPageHeader } from "@/components/page-header";
import { PageLayout } from "@/components/page-layout";
import { ServiceIntervalDialog } from "@/components/service-interval-dialog";
import { SubNav } from "@/components/sub-nav";
import {
  type EstateAssetCategory,
  useEstateAssetCategories,
  useSetSilentFailure,
} from "@/lib/asset-categories";
import {
  INTERVAL_UNITS,
  type IntervalUnit,
  type ServiceInterval,
  useSetCategoryServiceInterval,
} from "@/lib/service-intervals";
import { CategorySummaryCards } from "@/routes/_auth/estates/$estateId/asset-categories/-components/category-summary-cards";
import { SilentFailureDialog } from "@/routes/_auth/estates/$estateId/asset-categories/-components/silent-failure-dialog";

export type IntervalFilter = "ALL" | IntervalUnit | "NONE";

/** Each interval view's URL segment under /asset-categories/ (All is the index). */
export const INTERVAL_SLUGS: Record<Exclude<IntervalFilter, "ALL">, string> = {
  DAY: "days",
  MONTH: "months",
  YEAR: "years",
  NONE: "not-set",
};

/** The filter a `/asset-categories/$interval` segment names, if any. */
export function intervalFilterFor(slug: string): IntervalFilter | undefined {
  return (Object.keys(INTERVAL_SLUGS) as Exclude<IntervalFilter, "ALL">[]).find(
    (filter) => INTERVAL_SLUGS[filter] === slug
  );
}

function matches(category: EstateAssetCategory, filter: IntervalFilter) {
  if (filter === "ALL") {
    return true;
  }
  if (filter === "NONE") {
    return missing(category);
  }
  return category.serviceInterval?.unit === filter;
}

/** The most recent change to either the flag or the interval. */
function lastChanged(category: EstateAssetCategory): string {
  const changes = [category.lastChange, category.lastIntervalChange].filter(
    (change) => change !== null && change !== undefined
  );
  const [latest] = changes.sort((a, b) =>
    b.changedAt.localeCompare(a.changedAt)
  );
  if (!latest) {
    return "Default";
  }
  const by = latest.changedByName ?? "Unknown user";
  return `${by} · ${new Date(latest.changedAt).toLocaleString()}`;
}

function missing(category: EstateAssetCategory): boolean {
  return !category.serviceInterval;
}

function CategoryRow({
  category,
  disabled,
  onToggleFlag,
  onEditInterval,
}: {
  category: EstateAssetCategory;
  disabled: boolean;
  onToggleFlag: (category: EstateAssetCategory) => void;
  onEditInterval: (category: EstateAssetCategory) => void;
}) {
  const toggleFlag = useCallback(
    () => onToggleFlag(category),
    [category, onToggleFlag]
  );
  const editInterval = useCallback(
    () => onEditInterval(category),
    [category, onEditInterval]
  );
  return (
    <TableRow>
      <TableHead className="font-medium" scope="row">
        {category.label}
      </TableHead>
      <TableCell className="tabular-nums">
        {category.activeAssetCount}
      </TableCell>
      <TableCell>
        {category.failsSilently ? (
          <Badge variant="secondary">Fails silently</Badge>
        ) : (
          <span className="text-muted-foreground">No</span>
        )}
      </TableCell>
      <TableCell>
        <IntervalBadge interval={category.serviceInterval} />
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {lastChanged(category)}
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-2">
          <Button
            aria-label={`Edit service interval for ${category.label}`}
            disabled={disabled}
            onClick={editInterval}
            size="sm"
            variant="outline"
          >
            Edit interval
          </Button>
          <Button
            aria-label={
              category.failsSilently
                ? `Stop flagging ${category.label}`
                : `Flag ${category.label} as failing silently`
            }
            disabled={disabled}
            onClick={toggleFlag}
            size="sm"
            variant="ghost"
          >
            {category.failsSilently ? "Stop flagging" : "Flag"}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function byLabel(a: EstateAssetCategory, b: EstateAssetCategory): number {
  return a.label.localeCompare(b.label);
}

/**
 * The frame shared by every interval view: header, summary cards and the
 * service-interval SubNav. `children` (the current view) renders once the
 * categories have loaded.
 */
export function AssetCategoriesLayout({
  estateId,
  children,
}: {
  estateId: string;
  children: ReactNode;
}) {
  const categories = useEstateAssetCategories(estateId);
  const retry = useCallback(() => categories.refetch(), [categories.refetch]);
  const { data } = categories;
  return (
    <PageLayout className="min-w-0">
      <ListPageHeader
        description="Silent-failure flags and service intervals"
        icon={Tags}
        title="Asset categories"
      />
      {categories.isPending ? (
        <LoadingState label="Loading asset categories…" variant="table" />
      ) : null}
      {categories.error ? (
        <ErrorState message={categories.error.message} onRetry={retry} />
      ) : null}
      {data ? (
        <section aria-label="Asset categories" className="grid gap-4">
          <CategorySummaryCards
            categories={data.categories}
            estateId={estateId}
          />
          <SubNav
            items={[
              {
                exact: true,
                label: "All",
                params: { estateId },
                to: "/estates/$estateId/asset-categories",
              },
              ...(
                Object.keys(INTERVAL_SLUGS) as Exclude<IntervalFilter, "ALL">[]
              ).map((filter) => ({
                label:
                  filter === "NONE" ? "Not set" : INTERVAL_UNITS[filter].label,
                params: { estateId, interval: INTERVAL_SLUGS[filter] },
                to: "/estates/$estateId/asset-categories/$interval" as const,
              })),
            ]}
            label="Filter by service interval"
          />
          {children}
        </section>
      ) : null}
    </PageLayout>
  );
}

/** The categories table for one interval view, with its dialogs. */
export function AssetCategoriesList({
  estateId,
  filter,
}: {
  estateId: string;
  filter: IntervalFilter;
}) {
  const categories = useEstateAssetCategories(estateId);
  const setSilentFailure = useSetSilentFailure(estateId);
  const setServiceInterval = useSetCategoryServiceInterval(estateId);
  const [error, setError] = useState<string>();
  const [flagging, setFlagging] = useState<EstateAssetCategory>();
  const [editing, setEditing] = useState<EstateAssetCategory>();
  const { mutateAsync: saveInterval } = setServiceInterval;
  const closeInterval = useCallback(() => setEditing(undefined), []);
  const saveEditing = useCallback(
    async (interval: ServiceInterval | null) => {
      if (!editing) {
        return;
      }
      await saveInterval({ category: editing.code, interval });
      setEditing(undefined);
      toast.success("Service interval updated.");
    },
    [editing, saveInterval]
  );
  const { mutate } = setSilentFailure;
  const openFlag = useCallback((category: EstateAssetCategory) => {
    setError(undefined);
    setFlagging(category);
  }, []);
  const closeFlag = useCallback(() => {
    setError(undefined);
    setFlagging(undefined);
  }, []);
  const confirmFlag = useCallback(() => {
    if (!flagging) {
      return;
    }
    setError(undefined);
    mutate(
      { category: flagging.code, failsSilently: !flagging.failsSilently },
      {
        onSuccess: () => {
          setFlagging(undefined);
          toast.success("Asset category updated.");
        },
        onError: (cause) => setError(cause.message),
      }
    );
  }, [flagging, mutate]);
  const { data } = categories;
  if (!data) {
    return null;
  }
  const shown = data.categories
    .filter((category) => matches(category, filter))
    .sort(byLabel);
  return (
    <>
      {data.estateActive ? null : (
        <p className="text-muted-foreground" role="note">
          This estate is inactive, so its asset categories cannot be changed.
        </p>
      )}
      {shown.length === 0 ? (
        <EmptyState
          action={
            <Link
              className={buttonVariants({ variant: "outline" })}
              params={{ estateId }}
              to="/estates/$estateId/asset-categories"
            >
              Clear filters
            </Link>
          }
          description="No category uses this interval"
          icon={SearchX}
          title="No matching categories"
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead>Assets</TableHead>
              <TableHead>Fails silently</TableHead>
              <TableHead>Service interval</TableHead>
              <TableHead>Last changed</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((category) => (
              <CategoryRow
                category={category}
                disabled={!data.estateActive || setSilentFailure.isPending}
                key={category.code}
                onEditInterval={setEditing}
                onToggleFlag={openFlag}
              />
            ))}
          </TableBody>
        </Table>
      )}
      {flagging ? (
        <SilentFailureDialog
          category={flagging}
          error={error}
          onCancel={closeFlag}
          onConfirm={confirmFlag}
          pending={setSilentFailure.isPending}
        />
      ) : null}
      {editing ? (
        <ServiceIntervalDialog
          description={`How often the manufacturer says ${editing.label.toLowerCase()} assets should be serviced. Assets can override it.`}
          interval={editing.serviceInterval ?? null}
          onCancel={closeInterval}
          onSave={saveEditing}
          title={`Service interval for ${editing.label}`}
        />
      ) : null}
    </>
  );
}
