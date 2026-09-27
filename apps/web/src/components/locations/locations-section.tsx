import { Button } from "@proj/ui/components/button";
import { Input } from "@proj/ui/components/input";
import { Label } from "@proj/ui/components/label";
import { useQueryClient } from "@tanstack/react-query";
import {
  type ChangeEvent,
  type ReactNode,
  useCallback,
  useId,
  useMemo,
  useState,
} from "react";
import {
  LocationForm,
  type LocationFormValues,
  type ParentOption,
} from "@/components/locations/location-form";
import { api } from "@/lib/api";
import { estateError, useEstate, useEstateSession } from "@/lib/estates";
import {
  buildLocationTree,
  flattenLocations,
  type Location,
  type LocationNode,
  type LocationType,
  locationsQueryKey,
  locationTypeLabel,
  nextLevelPosition,
  searchLocations,
  useLocations,
} from "@/lib/locations";

type Panel =
  | { kind: "create"; type: LocationType; parent?: LocationNode }
  | { kind: "edit"; node: LocationNode }
  | { kind: "deactivate"; node: LocationNode };

const typeNoun: Record<LocationType, string> = {
  BLOCK: "block",
  LEVEL: "level",
  COMMON_AREA: "common area",
};

const EMPTY: Location[] = [];

export function LocationsSection({ estateId }: { estateId: string }) {
  const estate = useEstate(estateId);
  const locations = useLocations(estateId);
  const { userId } = useEstateSession();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [panel, setPanel] = useState<Panel>();
  const id = useId();

  // Hide every write control until we know the estate is active.
  const canEdit = Boolean(estate.data) && !estate.data?.deactivatedAt;
  const items = locations.data ?? EMPTY;
  const tree = useMemo(() => buildLocationTree(items), [items]);
  const matches = useMemo(() => searchLocations(items, query), [items, query]);
  const searching = query.trim() !== "";

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

  const panelView = panel ? (
    <PanelView
      items={items}
      onCancel={close}
      onCreate={create}
      onDeactivate={deactivate}
      onUpdate={update}
      panel={panel}
    />
  ) : null;
  const panelTargetId =
    panel?.kind === "create" ? panel.parent?.id : panel?.node.id;

  return (
    <section aria-labelledby={`${id}-heading`} className="mt-10">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-semibold text-xl" id={`${id}-heading`}>
          Locations
        </h2>
        {canEdit ? (
          <Button onClick={addBlock} variant="outline">
            Add block
          </Button>
        ) : null}
      </div>
      {panel?.kind === "create" && !panel.parent ? panelView : null}
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
      {locations.data && searching ? (
        <SearchResults matches={matches} query={query} />
      ) : null}
      {locations.data && !searching ? (
        <LocationTree
          canEdit={canEdit}
          onPanel={setPanel}
          panel={panelView}
          panelTargetId={panelTargetId}
          tree={tree}
        />
      ) : null}
    </section>
  );
}

function LocationTree({
  tree,
  canEdit,
  panel,
  panelTargetId,
  onPanel,
}: {
  tree: LocationNode[];
  canEdit: boolean;
  panel: ReactNode;
  panelTargetId?: string;
  onPanel: (panel: Panel) => void;
}) {
  if (!tree.length) {
    return (
      <p className="mt-4 text-sm" role="status">
        No locations yet.{canEdit ? " Add a block to start." : ""}
      </p>
    );
  }
  return (
    <ul aria-label="Location hierarchy" className="mt-4 grid gap-2">
      {tree.map((node) => (
        <LocationItem
          canEdit={canEdit}
          key={node.id}
          node={node}
          onPanel={onPanel}
          panel={panel}
          panelTargetId={panelTargetId}
        />
      ))}
    </ul>
  );
}

function LocationItem({
  node,
  canEdit,
  panel,
  panelTargetId,
  onPanel,
}: {
  node: LocationNode;
  canEdit: boolean;
  panel: ReactNode;
  panelTargetId?: string;
  onPanel: (panel: Panel) => void;
}) {
  const labelId = useId();
  return (
    <li aria-labelledby={labelId} className="border-l pl-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium" id={labelId}>
          {node.name}
        </span>
        <span className="text-muted-foreground text-xs">
          {locationTypeLabel[node.type]}
        </span>
        {canEdit ? <LocationActions node={node} onPanel={onPanel} /> : null}
      </div>
      {panelTargetId === node.id ? panel : null}
      {node.children.length ? (
        <ul className="mt-2 grid gap-2">
          {node.children.map((child) => (
            <LocationItem
              canEdit={canEdit}
              key={child.id}
              node={child}
              onPanel={onPanel}
              panel={panel}
              panelTargetId={panelTargetId}
            />
          ))}
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
    <span className="ml-auto flex flex-wrap gap-1">
      {node.type === "BLOCK" ? (
        <Button
          aria-label={`Add level to ${node.name}`}
          onClick={addLevel}
          size="xs"
          variant="ghost"
        >
          Add level
        </Button>
      ) : null}
      {node.type === "COMMON_AREA" ? null : (
        <Button
          aria-label={`Add common area to ${node.name}`}
          onClick={addCommonArea}
          size="xs"
          variant="ghost"
        >
          Add common area
        </Button>
      )}
      <Button
        aria-label={`Edit ${node.name}`}
        onClick={edit}
        size="xs"
        variant="ghost"
      >
        Edit
      </Button>
      <Button
        aria-label={`Deactivate ${node.name}`}
        onClick={deactivate}
        size="xs"
        variant="ghost"
      >
        Deactivate
      </Button>
    </span>
  );
}

function PanelView({
  panel,
  items,
  onCreate,
  onUpdate,
  onDeactivate,
  onCancel,
}: {
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
        onSave={save}
        parentOptions={parentOptions(items, node.type)}
        showPosition={node.type === "LEVEL"}
        title={`Edit ${node.name}`}
      />
    );
  }
  const { type, parent } = panel;
  const title = parent
    ? `Add ${typeNoun[type]} to ${parent.name}`
    : `Add ${typeNoun[type]}`;
  const suggestedPosition =
    type === "LEVEL" && parent
      ? nextLevelPosition(items, parent.id)
      : undefined;
  return (
    <LocationForm
      initialParentId={parent?.id}
      initialSortOrder={suggestedPosition}
      onCancel={onCancel}
      onSave={save}
      showPosition={type === "LEVEL"}
      title={title}
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

function SearchResults({
  matches,
  query,
}: {
  matches: LocationNode[];
  query: string;
}) {
  if (!matches.length) {
    return (
      <p className="mt-4 text-sm" role="status">
        No locations match “{query.trim()}”.
      </p>
    );
  }
  return (
    <ul aria-label="Search results" className="mt-4 grid gap-2">
      {matches.map((match) => (
        <li className="flex flex-wrap items-center gap-2" key={match.id}>
          <span>{match.path.join(" › ")}</span>
          <span className="text-muted-foreground text-xs">
            {locationTypeLabel[match.type]}
          </span>
        </li>
      ))}
    </ul>
  );
}

function DeactivateLocation({
  name,
  onConfirm,
  onCancel,
}: {
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
    }
  }, [onConfirm, pending]);
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
      <div className="flex gap-2">
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
