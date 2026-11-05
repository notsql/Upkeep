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
import { useCallback, useState } from "react";
import type { AssetFilters } from "@/lib/assets";
import { AssetFilterControls } from "@/routes/_auth/estates/$estateId/assets/-components/asset-filters";

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
      <DialogTrigger
        render={<Button className="sm:self-end" variant="outline" />}
      >
        Choose filters{count ? ` (${count})` : ""}
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
            fieldClassName="min-w-0"
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
