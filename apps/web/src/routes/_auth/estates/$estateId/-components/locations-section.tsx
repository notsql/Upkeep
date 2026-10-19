import { Button } from "@proj/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@proj/ui/components/dialog";
import { Input } from "@proj/ui/components/input";
import { Label } from "@proj/ui/components/label";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ChangeEvent, useCallback, useId, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { estateError, useEstate, useEstateSession } from "@/lib/estates";
import {
  buildLocationTree,
  filterLocationTree,
  type Location,
  type LocationNode,
  type LocationType,
  locationsQueryKey,
  useLocations,
} from "@/lib/locations";
import type { AddFloorsResult } from "@/routes/_auth/estates/$estateId/-components/add-floors-form";
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

export function LocationsSection({ estateId }: { estateId: string }) {
  const estate = useEstate(estateId);
  const locations = useLocations(estateId);
  const { userId } = useEstateSession();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState<Panel>();
  const id = useId();

  // Members can browse, but only the owner can change active locations.
  const canEdit = Boolean(estate.data?.owned) && !estate.data?.deactivatedAt;
  const items = locations.data ?? EMPTY;
  const tree = useMemo(() => buildLocationTree(items), [items]);
  const searching = query.trim() !== "";
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

  const create = useCallback(
    async (type: LocationType, values: LocationFormValues) => {
      const { error, response } = await api.POST(
        "/estates/{estateId}/locations",
        {
          params: { path: { estateId } },
          body: {
            type,
            name: values.name,
            ...(values.parentId ? { parentId: values.parentId } : {}),
            ...(type === "LEVEL" ? { sortOrder: values.sortOrder } : {}),
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

  const panelView =
    panel && canEdit ? (
      <PanelView
        items={items}
        onAddFloors={addFloors}
        onCancel={close}
        onCreate={create}
        onDeactivate={deactivate}
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
    return (
      document.getElementById(
        nodeId ? `location-actions-${nodeId}` : `${id}-add`
      ) ?? document.getElementById(`${id}-add`)
    );
  }, [panel, id]);

  return (
    <Dialog onOpenChange={changeOpen} open={Boolean(panel && canEdit)}>
      <section
        aria-labelledby={`${id}-heading`}
        className="section-surface mt-8 scroll-mt-24"
        id="locations"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-semibold text-xl" id={`${id}-heading`}>
            Locations
          </h2>
          {canEdit ? (
            <Button id={`${id}-add`} onClick={addBlock} variant="outline">
              Add block
            </Button>
          ) : null}
        </div>
        <div className="mt-4 grid gap-1">
          <Label htmlFor={`${id}-search`}>Search locations</Label>
          <Input
            id={`${id}-search`}
            onChange={search}
            placeholder="Block, level or common area name"
            type="search"
            value={query}
          />
        </div>
        {locations.isPending ? (
          <p aria-live="polite" className="mt-4">
            Loading locations…
          </p>
        ) : null}
        {locations.error ? (
          <p className="mt-4 text-destructive" role="alert">
            {locations.error.message}
          </p>
        ) : null}
        {locations.data ? (
          <LocationTree
            canEdit={canEdit}
            expandedIds={expandedIds ?? EMPTY_EXPANSION}
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
              <DialogDescription>{dialogDescription(panel)}</DialogDescription>
            </DialogHeader>
            {panelView}
          </DialogContent>
        ) : null}
      </section>
    </Dialog>
  );
}
