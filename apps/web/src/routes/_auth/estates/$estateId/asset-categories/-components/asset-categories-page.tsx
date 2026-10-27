import { Alert, AlertDescription } from "@proj/ui/components/alert";
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
import { PageHeader } from "@/components/page-header";
import {
  type EstateAssetCategory,
  useEstateAssetCategories,
  useSetSilentFailure,
} from "@/lib/asset-categories";

function lastChanged(category: EstateAssetCategory): string {
  if (!category.lastChange) {
    return "Default";
  }
  const by = category.lastChange.changedByName ?? "Unknown user";
  return `${by} · ${new Date(category.lastChange.changedAt).toLocaleString()}`;
}

function CategoryRow({
  category,
  disabled,
  onChange,
}: {
  category: EstateAssetCategory;
  disabled: boolean;
  onChange: (category: string, failsSilently: boolean) => void;
}) {
  const change = useCallback(
    (checked: boolean) => onChange(category.code, checked),
    [category.code, onChange]
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
      <TableCell>{lastChanged(category)}</TableCell>
    </TableRow>
  );
}

export function AssetCategoriesPage({ estateId }: { estateId: string }) {
  const categories = useEstateAssetCategories(estateId);
  const setSilentFailure = useSetSilentFailure(estateId);
  const [error, setError] = useState<string>();
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
  const flagged =
    data?.categories.filter((category) => category.failsSilently).length ?? 0;

  return (
    <main className="page-layout min-w-0">
      <PageHeader
        breadcrumbs={[
          { label: "Estates", to: "/estates" },
          { label: "Estate", to: "/estates/$estateId", params: { estateId } },
          { label: "Asset categories" },
        ]}
        description="Flag the categories of equipment that can fail without anyone noticing, such as common-area lighting, so they get regular spot checks."
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
          <p>
            {flagged === 1 ? "1 category" : `${flagged} categories`} flagged as
            failing silently
          </p>
          {data.estateActive ? null : (
            <p className="text-muted-foreground" role="note">
              This estate is inactive, so its asset categories cannot be
              changed.
            </p>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Assets</TableHead>
                <TableHead>Fails silently</TableHead>
                <TableHead>Last changed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.categories.map((category) => (
                <CategoryRow
                  category={category}
                  disabled={!data.estateActive || setSilentFailure.isPending}
                  key={category.code}
                  onChange={change}
                />
              ))}
            </TableBody>
          </Table>
        </section>
      ) : null}
    </main>
  );
}
