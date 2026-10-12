import { Button } from "@proj/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@proj/ui/components/dialog";
import { Field, FieldLabel } from "@proj/ui/components/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";
import { useCallback, useState } from "react";
import { conditionLabel } from "@/lib/assessments";
import type { AssetFilters } from "@/lib/assets";
import { useAssetCategories } from "@/lib/catalogue";

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Record<string, string>;
  onChange: (value: string) => void;
}) {
  const change = useCallback(
    (next: string | null) => onChange(next ?? ""),
    [onChange]
  );
  return (
    <Field className="min-w-0">
      <FieldLabel>{label}</FieldLabel>
      <Select onValueChange={change} value={value}>
        <SelectTrigger aria-label={label} className="w-full">
          <SelectValue>{options[value] ?? "All"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(options).map(([key, text]) => (
            <SelectItem key={key} value={key}>
              {text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
export function AssetFilterControls({
  filters,
  onChange,
  locations,
}: {
  filters: AssetFilters;
  onChange: (filters: AssetFilters) => void;
  locations: Record<string, string>;
}) {
  const categories = useAssetCategories();
  const categoryOptions = Object.fromEntries(
    (categories.data ?? []).map((item) => [item.code, item.label])
  );
  const category = useCallback(
    (value: string) =>
      onChange({
        ...filters,
        category: value || undefined,
      }),
    [filters, onChange]
  );
  const location = useCallback(
    (value: string) => onChange({ ...filters, locationId: value || undefined }),
    [filters, onChange]
  );
  const condition = useCallback(
    (value: string) =>
      onChange({
        ...filters,
        condition: (value as AssetFilters["condition"]) || undefined,
      }),
    [filters, onChange]
  );
  const status = useCallback(
    (value: string) =>
      onChange({ ...filters, status: value as AssetFilters["status"] }),
    [filters, onChange]
  );
  return (
    <>
      <FilterSelect
        label="Category"
        onChange={category}
        options={{ "": "All categories", ...categoryOptions }}
        value={filters.category ?? ""}
      />
      <FilterSelect
        label="Location"
        onChange={location}
        options={{ "": "All locations", ...locations }}
        value={filters.locationId ?? ""}
      />
      <FilterSelect
        label="Condition"
        onChange={condition}
        options={{
          "": "All conditions",
          ...conditionLabel,
          UNASSESSED: "Not assessed yet",
        }}
        value={filters.condition ?? ""}
      />
      <FilterSelect
        label="Status"
        onChange={status}
        options={{ ACTIVE: "Active", INACTIVE: "Retired", ALL: "All" }}
        value={filters.status ?? "ACTIVE"}
      />
    </>
  );
}
export function MobileAssetFilters({
  filters,
  onChange,
  locations,
}: {
  filters: AssetFilters;
  onChange: (filters: AssetFilters) => void;
  locations: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(filters);
  const changeOpen = useCallback(
    (next: boolean) => {
      if (next) {
        setDraft(filters);
      }
      setOpen(next);
    },
    [filters]
  );
  const cancel = useCallback(() => setOpen(false), []);
  const clear = useCallback(() => setDraft({}), []);
  const apply = useCallback(() => {
    onChange({ ...draft, q: filters.q });
    setOpen(false);
  }, [draft, filters.q, onChange]);
  const count = [
    filters.category,
    filters.locationId,
    filters.condition,
    filters.status && filters.status !== "ACTIVE",
  ].filter(Boolean).length;
  return (
    <Dialog onOpenChange={changeOpen} open={open}>
      <DialogTrigger render={<Button className="self-end" variant="outline" />}>
        Filters{count ? ` (${count})` : ""}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Filter assets</DialogTitle>
          <DialogDescription>
            Choose filters, then apply them to the asset list.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <AssetFilterControls
            filters={draft}
            locations={locations}
            onChange={setDraft}
          />
        </div>
        <DialogFooter>
          <Button onClick={clear} variant="ghost">
            Clear secondary filters
          </Button>
          <Button onClick={cancel} variant="outline">
            Cancel
          </Button>
          <Button onClick={apply}>Apply filters</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
