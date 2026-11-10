import { Dialog } from "@proj/ui/components/dialog";
import { MapPin } from "lucide-react";
import { ListPageHeader } from "@/components/page/list-page-header";
import { DeactivateLocation } from "@/routes/_auth/estates/$estateId/-components/locations-section/deactivate-location";
import { LocationsDialog } from "@/routes/_auth/estates/$estateId/-components/locations-section/locations-dialog";
import { LocationsFilters } from "@/routes/_auth/estates/$estateId/-components/locations-section/locations-filters";
import { LocationsTreeCard } from "@/routes/_auth/estates/$estateId/-components/locations-section/locations-tree-card";
import {
  EMPTY_EXPANSION,
  useLocationsSection,
} from "@/routes/_auth/estates/$estateId/-components/locations-section/use-locations-section";

export function LocationsSection({ estateId }: { estateId: string }) {
  const page = useLocationsSection(estateId);
  const { id, locations, panelOpen, deactivateTarget } = page;

  return (
    <>
      <ListPageHeader
        create={
          page.canCreate
            ? { id: `${id}-add-block`, onClick: page.addBlock }
            : undefined
        }
        filters={{
          activeCount: page.searching ? 1 : 0,
          ...page.filters.toggleProps,
        }}
        icon={MapPin}
        title="Locations"
      />
      <LocationsFilters
        barProps={page.filters.barProps}
        id={id}
        onClear={page.clearSearch}
        onSearch={page.search}
        query={page.query}
        searching={page.searching}
      />
      <Dialog onOpenChange={page.changeOpen} open={Boolean(panelOpen)}>
        <LocationsTreeCard
          dialog={
            panelOpen ? (
              <LocationsDialog
                busy={page.busy}
                items={page.items}
                onAddFloors={page.addFloors}
                onCancel={page.close}
                onCreate={page.create}
                onPendingChange={page.setBusy}
                onUpdate={page.update}
                panel={panelOpen}
                returnFocus={page.returnFocus}
              />
            ) : null
          }
          error={locations.error}
          onRetry={page.retryLocations}
          onViewChange={page.setView}
          pending={locations.isPending}
          tree={
            locations.data
              ? {
                  canCreate: page.canCreate,
                  canCreateFloors: page.canCreateFloors,
                  canDeactivate: page.canDeactivate,
                  canEdit: page.canEdit,
                  expandedIds: page.expandedIds ?? EMPTY_EXPANSION,
                  onClear: page.clearSearch,
                  onPanel: page.setPanel,
                  onToggle: page.toggleLocation,
                  query: page.query,
                  searching: page.searching,
                  summaries: page.summaries,
                  tree: page.visibleTree,
                }
              : undefined
          }
          view={page.view}
          viewLocked={page.searching}
        />
      </Dialog>
      {deactivateTarget ? (
        <DeactivateLocation
          name={deactivateTarget.name}
          onCancel={page.close}
          onConfirm={page.confirmDeactivate}
        />
      ) : null}
    </>
  );
}
