import type { components } from "@proj/api/schema";
import { Card, CardContent } from "@proj/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@proj/ui/components/dialog";
import { Field, FieldLabel } from "@proj/ui/components/field";
import { Input } from "@proj/ui/components/input";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building, MapPin } from "lucide-react";
import { type ChangeEvent, useCallback, useId, useMemo, useState } from "react";
import { ErrorState } from "@/components/error-state";
import { FilterBar, useFilterPanel } from "@/components/filter-bar";
import { LoadingState } from "@/components/loading-state";
import { ListPageHeader } from "@/components/page-header";
import { SectionHeading } from "@/components/section-heading";
import { useAppAccess } from "@/lib/access";
import { api } from "@/lib/api";
import { estateError, useEstate, useEstateSession } from "@/lib/estates";
import {
  buildLocationTree,
  filterLocationTree,
  type Location,
  type LocationNode,
  type LocationType,
  locationsQueryKey,
  useCreateLocation,
  useLocations,
} from "@/lib/locations";
import type { AddFloorsResult } from "@/routes/_auth/estates/$estateId/-components/add-floors-form";
import { DeactivateLocation } from "@/routes/_auth/estates/$estateId/-components/deactivate-location";
import type { LocationFormValues } from "@/routes/_auth/estates/$estateId/-components/location-form";
import {
  dialogDescription,
  type Panel,
  panelTitle,
} from "@/routes/_auth/estates/$estateId/-components/location-panel";
import { PanelView } from "@/routes/_auth/estates/$estateId/-components/location-panel-view";
import {
  LocationTree,
  locationSummaries,
} from "@/routes/_auth/estates/$estateId/-components/location-tree";

const EMPTY: Location[] = [];
const EMPTY_EXPANSION: string[] = [];

function locationPermissions(
  estate: ReturnType<typeof useEstate>["data"],
  permission: components["schemas"]["EstateAccessResponse"] | undefined
) {
  const active = Boolean(estate) && !estate?.deactivatedAt;
  const presetCreator =
    permission?.role === "MANAGER" && permission.canManageEstate;
  const canCreate =
    active &&
    Boolean(permission?.canCreateLocations ?? (estate?.owned || presetCreator));
  const canCreateFloors =
    active && Boolean(permission?.canCreateFloors ?? estate?.owned);
  const canEdit =
    active && Boolean(permission?.canEditLocations ?? estate?.owned);
  const canDeactivate = active && Boolean(estate?.owned);
  return {
    create: canCreate,
    levels: canCreateFloors,
    edit: canEdit,
    deactivate: canDeactivate,
  };
}

export function LocationsSection({ estateId }: { estateId: string }) {
  const estate = useEstate(estateId);
  const access = useAppAccess();
  const locations = useLocations(estateId);
  const { userId } = useEstateSession();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState<Panel>();
  const id = useId();

  const permission = access.data?.estates.find(
    (assignment) => assignment.estateId === estateId
  );
  const panelPermissions = locationPermissions(estate.data, permission);
  const {
    create: canCreate,
    levels: canCreateFloors,
    edit: canEdit,
    deactivate: canDeactivate,
  } = panelPermissions;
  const canOpenPanel = panel ? panelPermissions[panel.kind] : false;
  const items = locations.data ?? EMPTY;
  const tree = useMemo(() => buildLocationTree(items), [items]);
  const searching = query.trim() !== "";
  const filters = useFilterPanel(searching ? 1 : 0);
  const summaries = useMemo(() => locationSummaries(tree), [tree]);
  const visibleTree = useMemo(
    () => filterLocationTree(tree, query),
    [tree, query]
  );
  const expansionKey = useMemo(
    () => [userId, "location-expansion", estateId] as const,
    [userId, estateId]
  );
  // UI-only state survives route unmounts, without a request or browser storage.
  const { data: expandedIds } = useQuery<string[]>({
    queryKey: expansionKey,
    queryFn: skipToken,
    enabled: false,
    initialData: EMPTY_EXPANSION,
    gcTime: Number.POSITIVE_INFINITY,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const toggleLocation = useCallback(
    (nodeId: string) => {
      queryClient.setQueryData<string[]>(
        expansionKey,
        (current = EMPTY_EXPANSION) =>
          current.includes(nodeId)
            ? current.filter((value) => value !== nodeId)
            : [...current, nodeId]
      );
    },
    [queryClient, expansionKey]
  );

  const close = useCallback(() => setPanel(undefined), []);
  const addBlock = useCallback(
    () => setPanel({ kind: "create", type: "BLOCK" }),
    []
  );
  const clearSearch = useCallback(() => setQuery(""), []);
  const search = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value),
    []
  );
  const saved = useCallback(async () => {
    setPanel(undefined);
    await queryClient.invalidateQueries({
      queryKey: locationsQueryKey(userId, estateId),
    });
  }, [queryClient, userId, estateId]);

  const { mutateAsync: createLocation } = useCreateLocation(estateId, saved);

  const create = useCallback(
    async (type: LocationType, values: LocationFormValues) => {
      await createLocation({
        type,
        name: values.name,
        ...(values.parentId ? { parentId: values.parentId } : {}),
        ...(type === "LEVEL" ? { sortOrder: values.sortOrder } : {}),
      });
    },
    [createLocation]
  );

  const update = useCallback(
    async (node: LocationNode, values: LocationFormValues) => {
      const { error, response } = await api.PATCH(
        "/estates/{estateId}/locations/{id}",
        {
          params: { path: { estateId, id: node.id } },
          body: {
            name: values.name,
            ...(values.parentId ? { parentId: values.parentId } : {}),
            ...(node.type === "LEVEL" ? { sortOrder: values.sortOrder } : {}),
          },
        }
      );
      if (error) {
        throw estateError(error, response.status);
      }
      await saved();
    },
    [estateId, saved]
  );

  // The dialog stays open to show what was created and skipped; Done closes it.
  const addFloors = useCallback(
    async (
      node: LocationNode,
      lowestFloor: number,
      highestFloor: number
    ): Promise<AddFloorsResult> => {
      const { data, error, response } = await api.POST(
        "/estates/{estateId}/locations/{blockId}/floors",
        {
          params: { path: { estateId, blockId: node.id } },
          body: { lowestFloor, highestFloor },
        }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      await queryClient.invalidateQueries({
        queryKey: locationsQueryKey(userId, estateId),
      });
      return {
        created: data.created.map((level) => level.name),
        skipped: data.skipped,
      };
    },
    [estateId, queryClient, userId]
  );

  const deactivate = useCallback(
    async (node: LocationNode) => {
      const { error, response } = await api.POST(
        "/estates/{estateId}/locations/{id}/deactivate",
        { params: { path: { estateId, id: node.id } } }
      );
      if (error) {
        throw estateError(error, response.status);
      }
      await saved();
    },
    [estateId, saved]
  );

  const confirmDeactivate = useCallback(
    () =>
      panel?.kind === "deactivate" ? deactivate(panel.node) : Promise.resolve(),
    [panel, deactivate]
  );
  const retryLocations = useCallback(() => {
    locations.refetch();
  }, [locations]);
  const deactivating = panel?.kind === "deactivate" && canOpenPanel;
  const panelView =
    panel && canOpenPanel && !deactivating ? (
      <PanelView
        items={items}
        onAddFloors={addFloors}
        onCancel={close}
        onCreate={create}
        onPendingChange={setBusy}
        onUpdate={update}
        panel={panel}
      />
    ) : null;
  const dialogTitle = panelTitle(panel);
  const changeOpen = useCallback(
    (open: boolean) => {
      if (!(open || busy)) {
        close();
      }
    },
    [busy, close]
  );
  const returnFocus = useCallback(() => {
    const nodeId = panel?.kind === "create" ? panel.parent?.id : panel?.node.id;
    // biome-ignore lint/style/useDomQuerySelector: useId values are not valid CSS selectors
    return document.getElementById(
      nodeId ? `location-actions-${nodeId}` : `${id}-add-block`
    );
  }, [panel, id]);

  return (
    <>
      <ListPageHeader
        create={
          canCreate ? { id: `${id}-add-block`, onClick: addBlock } : undefined
        }
        filters={{ activeCount: searching ? 1 : 0, ...filters.toggleProps }}
        icon={MapPin}
        title="Locations"
      />
      <FilterBar
        activeCount={searching ? 1 : 0}
        label="Filter locations"
        onClear={clearSearch}
        search={
          <Field>
            <FieldLabel htmlFor={`${id}-search`}>Search locations</FieldLabel>
            <Input
              id={`${id}-search`}
              onChange={search}
              placeholder="Block, level or common area name"
              type="search"
              value={query}
            />
          </Field>
        }
        {...filters.barProps}
      />
      <Dialog onOpenChange={changeOpen} open={Boolean(panelView)}>
        <Card className="mt-4">
          <CardContent>
            <section
              aria-labelledby={`${id}-heading`}
              className="scroll-mt-24"
              id="locations"
            >
              <SectionHeading icon={Building} id={`${id}-heading`}>
                Blocks and levels
              </SectionHeading>
              {locations.isPending ? (
                <div className="mt-4">
                  <LoadingState label="Loading locations…" />
                </div>
              ) : null}
              {locations.error ? (
                <div className="mt-4">
                  <ErrorState
                    message={locations.error.message}
                    onRetry={retryLocations}
                  />
                </div>
              ) : null}
              {locations.data ? (
                <LocationTree
                  canCreate={canCreate}
                  canCreateFloors={canCreateFloors}
                  canDeactivate={canDeactivate}
                  canEdit={canEdit}
                  expandedIds={expandedIds ?? EMPTY_EXPANSION}
                  onClear={clearSearch}
                  onCreate={addBlock}
                  onPanel={setPanel}
                  onToggle={toggleLocation}
                  query={query}
                  searching={searching}
                  summaries={summaries}
                  tree={visibleTree}
                />
              ) : null}
              {panelView ? (
                <DialogContent
                  className="sm:max-w-lg"
                  finalFocus={returnFocus}
                  showCloseButton={!busy}
                >
                  <DialogHeader>
                    <DialogTitle>{dialogTitle}</DialogTitle>
                    <DialogDescription>
                      {dialogDescription(panel)}
                    </DialogDescription>
                  </DialogHeader>
                  {panelView}
                </DialogContent>
              ) : null}
            </section>
          </CardContent>
        </Card>
      </Dialog>
      {deactivating ? (
        <DeactivateLocation
          name={panel.node.name}
          onCancel={close}
          onConfirm={confirmDeactivate}
        />
      ) : null}
    </>
  );
}
