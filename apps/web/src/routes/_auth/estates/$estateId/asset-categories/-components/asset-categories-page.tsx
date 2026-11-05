import { buttonVariants } from "@proj/ui/components/button";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import { Link } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { ServiceIntervalDialog } from "@/components/service-interval-dialog";
import {
  type EstateAssetCategory,
  useEstateAssetCategories,
  useSetSilentFailure,
} from "@/lib/asset-categories";
import {
  type ServiceInterval,
  useSetCategoryServiceInterval,
} from "@/lib/service-intervals";
import { SilentFailureDialog } from "@/routes/_auth/estates/$estateId/asset-categories/-components/silent-failure-dialog";
import { CategoryRow } from "./category-row";
import { INTERVAL_SLUGS, type IntervalFilter } from "./interval-filter";

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

function missing(category: EstateAssetCategory): boolean {
  return !category.serviceInterval;
}

function byLabel(a: EstateAssetCategory, b: EstateAssetCategory): number {
  return a.label.localeCompare(b.label);
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
