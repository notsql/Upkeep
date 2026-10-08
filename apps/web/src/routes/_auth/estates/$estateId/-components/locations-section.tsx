import { Button } from "@proj/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@proj/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@proj/ui/components/dropdown-menu";
import { Input } from "@proj/ui/components/input";
import { Label } from "@proj/ui/components/label";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, MoreHorizontal } from "lucide-react";
import { type ChangeEvent, useCallback, useId, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { estateError, useEstate, useEstateSession } from "@/lib/estates";
import {
  buildLocationTree,
  filterLocationTree,
  flattenLocations,
  type Location,
  type LocationNode,
  type LocationType,
  locationsQueryKey,
  nextLevelPosition,
  useLocations,
} from "@/lib/locations";
import {
  LocationForm,
  type LocationFormValues,
  type ParentOption,
} from "@/routes/_auth/estates/$estateId/-components/location-form";

type Panel =
  | { kind: "create"; type: LocationType; parent?: LocationNode }
  | { kind: "edit"; node: LocationNode }
  | { kind: "deactivate"; node: LocationNode };

const typeNoun: Record<LocationType, string> = {
  BLOCK: "block",
  LEVEL: "level",
  COMMON_AREA: "common area",
};

function panelTitle(panel?: Panel): string {
  if (!panel) {
    return "Location";
  }
  if (panel.kind === "create") {
    return `Add ${typeNoun[panel.type]}${panel.parent ? ` to ${panel.parent.name}` : ""}`;
  }
  if (panel.kind === "edit") {
    return `Edit ${panel.node.name}`;
  }
  return `Deactivate ${panel.node.name}?`;
}

const EMPTY: Location[] = [];
const EMPTY_EXPANSION: string[] = [];

function locationSummaries(tree: LocationNode[]): Map<string, string> {
  const summaries = new Map<string, string>();
  const visit = (node: LocationNode): number => {
    const areas = node.children.reduce(
      (count, child) => count + visit(child),
      0
    );
    const areaLabel = `${areas} common ${areas === 1 ? "area" : "areas"}`;
    if (node.type === "BLOCK") {
      const levels = node.children.filter(
        (child) => child.type === "LEVEL"
      ).length;
      summaries.set(
        node.id,
        `${levels} ${levels === 1 ? "level" : "levels"} · ${areaLabel}`
      );
    } else {
      summaries.set(node.id, node.type === "LEVEL" ? areaLabel : "Common area");
    }
    return node.type === "COMMON_AREA" ? 1 : areas;
  };
  for (const node of tree) {
    visit(node);
  }
  return summaries;
}

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
              <DialogDescription>
                {panel?.kind === "deactivate"
                  ? "Review the effect before confirming."
                  : "Enter the location details below."}
              </DialogDescription>
            </DialogHeader>
            {panelView}
          </DialogContent>
        ) : null}
      </section>
    </Dialog>
  );
}

function LocationTree({
  tree,
  canEdit,
  onPanel,
  summaries,
  expandedIds,
  onToggle,
  searching,
  query,
}: {
  tree: LocationNode[];
  canEdit: boolean;
  onPanel: (panel: Panel) => void;
  summaries: Map<string, string>;
  expandedIds: string[];
  onToggle: (id: string) => void;
  searching: boolean;
  query: string;
}) {
  if (!tree.length) {
    return (
      <p className="mt-4 text-sm" role="status">
        {searching
          ? `No locations match “${query.trim()}”.`
          : "No locations yet."}
        {!searching && canEdit ? " Add a block to start." : ""}
      </p>
    );
  }
  return (
    <ul
      aria-label={searching ? "Search results" : "Location hierarchy"}
      className="mt-4 grid gap-2"
    >
      {tree.map((node) => (
        <LocationItem
          canEdit={canEdit}
          expandedIds={expandedIds}
          key={node.id}
          node={node}
          onPanel={onPanel}
          onToggle={onToggle}
          searching={searching}
          summaries={summaries}
        />
      ))}
    </ul>
  );
}

function LocationItem({
  node,
  canEdit,
  onPanel,
  summaries,
  expandedIds,
  onToggle,
  searching,
}: {
  node: LocationNode;
  canEdit: boolean;
  onPanel: (panel: Panel) => void;
  summaries: Map<string, string>;
  expandedIds: string[];
  onToggle: (id: string) => void;
  searching: boolean;
}) {
  const labelId = useId();
  const childrenId = useId();
  const expanded = searching || expandedIds.includes(node.id);
  const toggle = useCallback(() => onToggle(node.id), [onToggle, node.id]);
  const title = (
    <span className="flex min-w-0 flex-col gap-1">
      <span className="break-words font-medium" id={labelId}>
        {node.name}
      </span>
      <span className="text-muted-foreground text-xs">
        {summaries.get(node.id)}
      </span>
    </span>
  );
  return (
    <li
      aria-labelledby={labelId}
      className={
        node.type === "BLOCK"
          ? "rounded-lg border bg-muted/20 p-2"
          : "border-l pl-3"
      }
    >
      <div className="flex items-center gap-2">
        {node.children.length && !searching ? (
          <Button
            aria-controls={childrenId}
            aria-expanded={expanded}
            aria-label={`${expanded ? "Collapse" : "Expand"} ${node.name}`}
            className="h-auto min-w-0 flex-1 justify-start gap-3 whitespace-normal p-2 text-left"
            onClick={toggle}
            variant="ghost"
          >
            {expanded ? (
              <ChevronDown aria-hidden="true" className="shrink-0" />
            ) : (
              <ChevronRight aria-hidden="true" className="shrink-0" />
            )}
            {title}
          </Button>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-3 p-2">
            {node.children.length ? (
              <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
            ) : null}
            {title}
          </div>
        )}
        {canEdit ? <LocationActions node={node} onPanel={onPanel} /> : null}
      </div>
      {node.children.length ? (
        <ul className="mt-2 grid gap-2" hidden={!expanded} id={childrenId}>
          {expanded
            ? node.children.map((child) => (
                <LocationItem
                  canEdit={canEdit}
                  expandedIds={expandedIds}
                  key={child.id}
                  node={child}
                  onPanel={onPanel}
                  onToggle={onToggle}
                  searching={searching}
                  summaries={summaries}
                />
              ))
            : null}
        </ul>
      ) : null}
    </li>
  );
}

function LocationActions({
  node,
  onPanel,
}: {
  node: LocationNode;
  onPanel: (panel: Panel) => void;
}) {
  const addLevel = useCallback(
    () => onPanel({ kind: "create", type: "LEVEL", parent: node }),
    [node, onPanel]
  );
  const addCommonArea = useCallback(
    () => onPanel({ kind: "create", type: "COMMON_AREA", parent: node }),
    [node, onPanel]
  );
  const edit = useCallback(
    () => onPanel({ kind: "edit", node }),
    [node, onPanel]
  );
  const deactivate = useCallback(
    () => onPanel({ kind: "deactivate", node }),
    [node, onPanel]
  );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={`Actions for ${node.name}`}
            className="ml-auto shrink-0"
            id={`location-actions-${node.id}`}
            size="icon"
            variant="ghost"
          />
        }
      >
        <MoreHorizontal aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {node.type === "BLOCK" ? (
          <DropdownMenuItem
            aria-label={`Add level to ${node.name}`}
            onClick={addLevel}
          >
            Add level
          </DropdownMenuItem>
        ) : null}
        {node.type === "COMMON_AREA" ? null : (
          <DropdownMenuItem
            aria-label={`Add common area to ${node.name}`}
            onClick={addCommonArea}
          >
            Add common area
          </DropdownMenuItem>
        )}
        <DropdownMenuItem aria-label={`Edit ${node.name}`} onClick={edit}>
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          aria-label={`Deactivate ${node.name}`}
          className="text-destructive"
          onClick={deactivate}
        >
          Deactivate
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PanelView({
  onPendingChange,
  panel,
  items,
  onCreate,
  onUpdate,
  onDeactivate,
  onCancel,
}: {
  onPendingChange: (pending: boolean) => void;
  panel: Panel;
  items: Location[];
  onCreate: (type: LocationType, values: LocationFormValues) => Promise<void>;
  onUpdate: (node: LocationNode, values: LocationFormValues) => Promise<void>;
  onDeactivate: (node: LocationNode) => Promise<void>;
  onCancel: () => void;
}) {
  const save = useCallback(
    (values: LocationFormValues) => {
      if (panel.kind === "edit") {
        return onUpdate(panel.node, values);
      }
      if (panel.kind === "create") {
        return onCreate(panel.type, values);
      }
      return Promise.resolve();
    },
    [panel, onCreate, onUpdate]
  );
  const confirm = useCallback(
    () =>
      panel.kind === "deactivate"
        ? onDeactivate(panel.node)
        : Promise.resolve(),
    [panel, onDeactivate]
  );
  if (panel.kind === "deactivate") {
    return (
      <DeactivateLocation
        name={panel.node.name}
        onCancel={onCancel}
        onConfirm={confirm}
        onPendingChange={onPendingChange}
      />
    );
  }
  if (panel.kind === "edit") {
    const { node } = panel;
    return (
      <LocationForm
        initialName={node.name}
        initialParentId={node.parentId ?? undefined}
        initialSortOrder={node.sortOrder ?? undefined}
        onCancel={onCancel}
        onPendingChange={onPendingChange}
        onSave={save}
        parentOptions={parentOptions(items, node.type)}
        showPosition={node.type === "LEVEL"}
        title={panelTitle(panel)}
      />
    );
  }
  const { type, parent } = panel;
  const suggestedPosition =
    type === "LEVEL" && parent
      ? nextLevelPosition(items, parent.id)
      : undefined;
  return (
    <LocationForm
      initialParentId={parent?.id}
      initialSortOrder={suggestedPosition}
      onCancel={onCancel}
      onPendingChange={onPendingChange}
      onSave={save}
      showPosition={type === "LEVEL"}
      title={panelTitle(panel)}
    />
  );
}

/** Where a location of this type may be moved to; blocks never move. */
function parentOptions(
  items: Location[],
  type: LocationType
): ParentOption[] | undefined {
  if (type === "BLOCK") {
    return;
  }
  const allowed: LocationType[] =
    type === "LEVEL" ? ["BLOCK"] : ["BLOCK", "LEVEL"];
  return flattenLocations(items)
    .filter((node) => allowed.includes(node.type))
    .map((node) => ({ id: node.id, label: node.path.join(" › ") }));
}

function DeactivateLocation({
  onPendingChange,
  name,
  onConfirm,
  onCancel,
}: {
  onPendingChange: (pending: boolean) => void;
  name: string;
  onConfirm: () => Promise<unknown>;
  onCancel: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const confirm = useCallback(async () => {
    if (pending) {
      return;
    }
    setPending(true);
    onPendingChange(true);
    setError(undefined);
    try {
      await onConfirm();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to deactivate the location. Please try again."
      );
    } finally {
      setPending(false);
      onPendingChange(false);
    }
  }, [onConfirm, pending, onPendingChange]);
  return (
    <fieldset className="mt-2 grid gap-2 border p-3">
      <legend className="font-medium text-sm">Deactivate {name}?</legend>
      <p className="text-muted-foreground text-sm">
        It stays on record so existing references keep working, but it is hidden
        from the hierarchy and cannot be changed or reactivated.
      </p>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending} onClick={confirm} variant="destructive">
          {pending ? "Deactivating…" : "Deactivate"}
        </Button>
        <Button disabled={pending} onClick={onCancel} variant="outline">
          Cancel
        </Button>
      </div>
    </fieldset>
  );
}
