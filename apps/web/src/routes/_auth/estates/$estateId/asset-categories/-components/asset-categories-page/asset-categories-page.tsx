import { buttonVariants } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";
import { ServiceIntervalDialog } from "@/components/service-intervals/service-interval-dialog";
import { EmptyState } from "@/components/states/empty-state";
import { AssetCategoriesTable } from "@/routes/_auth/estates/$estateId/asset-categories/-components/asset-categories-page/asset-categories-table";
import { SilentFailureDialog } from "@/routes/_auth/estates/$estateId/asset-categories/-components/asset-categories-page/silent-failure-dialog";
import { useAssetCategoriesList } from "@/routes/_auth/estates/$estateId/asset-categories/-components/asset-categories-page/use-asset-categories-list";
import {
  INTERVAL_SLUGS,
  type IntervalFilter,
} from "@/routes/_auth/estates/$estateId/asset-categories/-components/interval-filter";

/** The filter a `/asset-categories/$interval` segment names, if any. */
export function intervalFilterFor(slug: string): IntervalFilter | undefined {
  return (Object.keys(INTERVAL_SLUGS) as Exclude<IntervalFilter, "ALL">[]).find(
    (filter) => INTERVAL_SLUGS[filter] === slug
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
  const list = useAssetCategoriesList(estateId, filter);
  const { data, shown, flagging, editing } = list;
  if (!(data && shown)) {
    return null;
  }
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
        <AssetCategoriesTable
          categories={shown}
          disabled={!data.estateActive || list.pending}
          onEditInterval={list.setEditing}
          onToggleFlag={list.openFlag}
        />
      )}
      {flagging ? (
        <SilentFailureDialog
          category={flagging}
          error={list.error}
          onCancel={list.closeFlag}
          onConfirm={list.confirmFlag}
          pending={list.pending}
        />
      ) : null}
      {editing ? (
        <ServiceIntervalDialog
          description={`How often the manufacturer says ${editing.label.toLowerCase()} assets should be serviced. Assets can override it.`}
          interval={editing.serviceInterval ?? null}
          onCancel={list.closeInterval}
          onSave={list.saveEditing}
          title={`Service interval for ${editing.label}`}
        />
      ) : null}
    </>
  );
}
