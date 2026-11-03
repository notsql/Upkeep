import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import { Checkbox } from "@proj/ui/components/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { IntervalBadge } from "@/components/interval-badge";
import { PageHeader } from "@/components/page-header";
import { ServiceIntervalDialog } from "@/components/service-interval-dialog";
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

type IntervalFilter = "ALL" | IntervalUnit | "NONE";

const FILTERS: { value: IntervalFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  ...Object.entries(INTERVAL_UNITS).map(([value, unit]) => ({
    value: value as IntervalUnit,
    label: unit.label,
  })),
  { value: "NONE", label: "Not set" },
];

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
  onChange,
  onEditInterval,
}: {
  category: EstateAssetCategory;
  disabled: boolean;
  onChange: (category: string, failsSilently: boolean) => void;
  onEditInterval: (category: EstateAssetCategory) => void;
}) {
  const change = useCallback(
    (checked: boolean) => onChange(category.code, checked),
    [category.code, onChange]
  );
  const editInterval = useCallback(
    () => onEditInterval(category),
    [category, onEditInterval]
  );
  return (
    <TableRow>
      <TableHead scope="row">{category.label}</TableHead>
      <TableCell>{category.activeAssetCount}</TableCell>
      <TableCell>
        <Checkbox
          aria-label={`${category.label} fails silently`}
          checked={category.failsSilently}
          disabled={disabled}
          onCheckedChange={change}
        />
      </TableCell>
      <TableCell>
        <IntervalBadge interval={category.serviceInterval} />
      </TableCell>
      <TableCell>{lastChanged(category)}</TableCell>
      <TableCell>
        <Button
          aria-label={`Edit service interval for ${category.label}`}
          disabled={disabled}
          onClick={editInterval}
          size="sm"
          variant="outline"
        >
          Edit interval
        </Button>
      </TableCell>
    </TableRow>
  );
}

export function AssetCategoriesPage({ estateId }: { estateId: string }) {
  const categories = useEstateAssetCategories(estateId);
  const setSilentFailure = useSetSilentFailure(estateId);
  const setServiceInterval = useSetCategoryServiceInterval(estateId);
  const [error, setError] = useState<string>();
  const [editing, setEditing] = useState<EstateAssetCategory>();
  const [filter, setFilter] = useState<IntervalFilter>("ALL");
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
  const showMissing = useCallback(() => setFilter("NONE"), []);
  const chooseFilter = useCallback(
    (event: { currentTarget: HTMLButtonElement }) =>
      setFilter(event.currentTarget.value as IntervalFilter),
    []
  );
  const { mutate } = setSilentFailure;
  const change = useCallback(
    (category: string, failsSilently: boolean) => {
      setError(undefined);
      mutate(
        { category, failsSilently },
        {
          onSuccess: () => toast.success("Asset category updated."),
          onError: (cause) => setError(cause.message),
        }
      );
    },
    [mutate]
  );
  const { data } = categories;
  const shown =
    data?.categories.filter((category) => matches(category, filter)) ?? [];

  return (
    <main className="page-layout min-w-0">
      <PageHeader
        breadcrumbs={[
          { label: "Estates", to: "/estates" },
          { label: "Estate", to: "/estates/$estateId", params: { estateId } },
          { label: "Asset categories" },
        ]}
        description="Flag the categories of equipment that can fail without anyone noticing, such as common-area lighting, so they get regular spot checks, and record how often the manufacturer says each category should be serviced."
        title="Asset categories"
      />
      {categories.isPending ? (
        <p aria-live="polite">Loading asset categories…</p>
      ) : null}
      {categories.error ? (
        <Alert variant="destructive">
          <AlertDescription>{categories.error.message}</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert className="mb-4" variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {data ? (
        <section aria-label="Asset categories" className="grid gap-4">
          <CategorySummaryCards
            categories={data.categories}
            onShowMissing={showMissing}
          />
          <fieldset className="flex flex-wrap gap-2">
            <legend className="sr-only">Filter by service interval</legend>
            {FILTERS.map((option) => (
              <Button
                aria-pressed={filter === option.value}
                key={option.value}
                onClick={chooseFilter}
                size="sm"
                type="button"
                value={option.value}
                variant={filter === option.value ? "default" : "outline"}
              >
                {option.label}
              </Button>
            ))}
          </fieldset>
          {data.estateActive ? null : (
            <p className="text-muted-foreground" role="note">
              This estate is inactive, so its asset categories cannot be
              changed.
            </p>
          )}
          {shown.length === 0 ? (
            <p className="text-muted-foreground">
              No categories match this filter.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Assets</TableHead>
                  <TableHead>Fails silently</TableHead>
                  <TableHead>Service interval</TableHead>
                  <TableHead>Last changed</TableHead>
                  <TableHead>
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
                    onChange={change}
                    onEditInterval={setEditing}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </section>
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
    </main>
  );
}
