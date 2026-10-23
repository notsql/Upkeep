import { Button } from "@proj/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@proj/ui/components/dialog";
import { Field, FieldLabel } from "@proj/ui/components/field";
import { Input } from "@proj/ui/components/input";
import {
  type ChangeEvent,
  type MouseEvent,
  useCallback,
  useState,
} from "react";
import { useWorkOrderAssets } from "@/lib/work-orders";

export function WorkOrderAssetPicker({
  estateId,
  onChange,
}: {
  estateId: string;
  onChange: (id: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState<string>();
  const [selected, setSelected] = useState<
    { id: string; label: string } | undefined
  >(undefined);
  const assets = useWorkOrderAssets(estateId, query, cursor);
  const search = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
    setCursor(undefined);
  }, []);
  const first = useCallback(() => setCursor(undefined), []);
  const next = useCallback(
    () => setCursor(assets.data?.nextCursor ?? undefined),
    [assets.data?.nextCursor]
  );
  const choose = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const asset = assets.data?.items.find(
        (item) => item.id === event.currentTarget.value
      );
      if (!asset) {
        return;
      }
      setSelected({
        id: asset.id,
        label: `${asset.reference} — ${asset.name}`,
      });
      onChange(asset.id);
      setOpen(false);
      setQuery("");
      setCursor(undefined);
    },
    [assets.data?.items, onChange]
  );
  const remove = useCallback(() => {
    setSelected(undefined);
    onChange(undefined);
  }, [onChange]);
  return (
    <Field>
      <FieldLabel htmlFor="work-linked-asset">
        Linked asset (optional)
      </FieldLabel>
      <div className="flex flex-wrap gap-2">
        <Dialog onOpenChange={setOpen} open={open}>
          <DialogTrigger
            render={
              <Button
                className="h-auto min-h-11 justify-start whitespace-normal text-left"
                id="work-linked-asset"
                type="button"
                variant="outline"
              />
            }
          >
            {selected?.label ?? "No linked asset"}
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Choose linked asset</DialogTitle>
              <DialogDescription>
                Search by asset name or reference, then choose a result. Linking
                an asset is optional.
              </DialogDescription>
            </DialogHeader>
            <Field>
              <FieldLabel htmlFor="work-asset-search">Search assets</FieldLabel>
              <Input
                id="work-asset-search"
                maxLength={200}
                onChange={search}
                placeholder="Search by name or reference"
                value={query}
              />
            </Field>
            {assets.isPending ? <p role="status">Searching assets…</p> : null}
            {assets.isError ? (
              <p role="alert">
                Asset options are unavailable. You can continue without an
                asset.
              </p>
            ) : null}
            {!(assets.isPending || assets.isError) && assets.data ? (
              <div className="grid max-h-72 gap-2 overflow-y-auto">
                {assets.data.items.length === 0 ? (
                  <p>
                    {query
                      ? "No matching assets."
                      : "No active assets available."}
                  </p>
                ) : null}
                {assets.data.items.map((asset) => (
                  <Button
                    aria-pressed={selected?.id === asset.id}
                    className="h-auto justify-start whitespace-normal py-3 text-left"
                    key={asset.id}
                    onClick={choose}
                    type="button"
                    value={asset.id}
                    variant="outline"
                  >
                    <span>
                      <span className="block">
                        {asset.reference} — {asset.name}
                      </span>
                      <span className="block text-muted-foreground text-xs">
                        {asset.locationPath}
                      </span>
                    </span>
                  </Button>
                ))}
              </div>
            ) : null}
            <div className="flex gap-2">
              {cursor ? (
                <Button onClick={first} type="button" variant="outline">
                  First asset page
                </Button>
              ) : null}
              {assets.data?.nextCursor && !assets.isError ? (
                <Button onClick={next} type="button" variant="outline">
                  Next assets
                </Button>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
        {selected ? (
          <Button onClick={remove} type="button" variant="ghost">
            Remove linked asset
          </Button>
        ) : null}
      </div>
      <p className="text-muted-foreground text-sm">
        Choose an existing asset, or leave it unlinked if the equipment is not
        registered.
      </p>
    </Field>
  );
}
