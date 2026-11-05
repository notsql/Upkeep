import type { components } from "@proj/api/schema";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ChangeEvent, useCallback, useId, useMemo, useState } from "react";
import { useFilterPanel } from "@/components/filters/filter-bar";
import { useAppAccess } from "@/lib/access";
import { useEstate, useEstateSession } from "@/lib/estates";
import {
  addBlockFloors,
  buildLocationTree,
  deactivateLocation,
  filterLocationTree,
  type Location,
  type LocationNode,
  type LocationType,
  locationsQueryKey,
  updateLocation,
  useCreateLocation,
  useLocations,
} from "@/lib/locations";
import type { AddFloorsResult } from "@/routes/_auth/estates/$estateId/-components/locations-section/add-floors-form/add-floors-form";
import type { LocationFormValues } from "@/routes/_auth/estates/$estateId/-components/locations-section/location-form/location-form";
import type { Panel } from "@/routes/_auth/estates/$estateId/-components/locations-section/location-panel";
import { locationSummaries } from "@/routes/_auth/estates/$estateId/-components/locations-section/location-tree";

const EMPTY: Location[] = [];
export const EMPTY_EXPANSION: string[] = [];

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

export function useLocationsSection(estateId: string) {
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
      await updateLocation(estateId, node.id, {
        name: values.name,
        ...(values.parentId ? { parentId: values.parentId } : {}),
        ...(node.type === "LEVEL" ? { sortOrder: values.sortOrder } : {}),
      });
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
      const data = await addBlockFloors(
        estateId,
        node.id,
        lowestFloor,
        highestFloor
      );
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
      await deactivateLocation(estateId, node.id);
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
  const deactivateTarget = deactivating ? panel.node : undefined;
  const panelOpen = panel && canOpenPanel && !deactivating ? panel : undefined;
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

  return {
    id,
    addBlock,
    addFloors,
    busy,
    canCreate,
    canCreateFloors,
    canDeactivate,
    canEdit,
    changeOpen,
    clearSearch,
    close,
    confirmDeactivate,
    create,
    deactivateTarget,
    expandedIds,
    filters,
    items,
    locations,
    panelOpen,
    query,
    retryLocations,
    returnFocus,
    search,
    searching,
    setBusy,
    setPanel,
    summaries,
    toggleLocation,
    update,
    visibleTree,
  };
}
