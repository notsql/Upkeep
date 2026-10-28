import { Button } from "@proj/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@proj/ui/components/dialog";
import { Input } from "@proj/ui/components/input";
import { Label } from "@proj/ui/components/label";
import { type ChangeEvent, useCallback, useState } from "react";
import { type ReadingAsset, useReadingAssets } from "@/lib/readings";

function ReadingAssetChoice({
  asset,
  onChoose,
  activeOnly,
}: {
  activeOnly: boolean;
  asset: ReadingAsset;
  onChoose: (asset: ReadingAsset) => void;
}) {
  const choose = useCallback(() => onChoose(asset), [asset, onChoose]);
  return (
    <Button
      className="h-auto min-h-11 justify-start whitespace-normal text-left [overflow-wrap:anywhere]"
      disabled={activeOnly && asset.retired}
      onClick={choose}
      variant="outline"
    >
      {asset.reference} · {asset.name}
      {asset.retired ? " · Retired" : ""}
    </Button>
  );
}

export function ReadingAssetPicker({
  estateId,
  label,
  onChoose,
  mode = "filter",
}: {
  mode?: "filter" | "record";
  estateId: string;
  label: string;
  onChoose: (asset: ReadingAsset | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const assets = useReadingAssets(estateId, search, page, open);
  const choose = useCallback(
    (asset: ReadingAsset | undefined) => {
      onChoose(asset);
      setOpen(false);
    },
    [onChoose]
  );
  const clear = useCallback(() => choose(undefined), [choose]);
  const searchChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
    setPage(0);
  }, []);
  const retry = useCallback(() => assets.refetch(), [assets.refetch]);
  const previous = useCallback(() => setPage((current) => current - 1), []);
  const next = useCallback(() => setPage((current) => current + 1), []);
  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger
        render={
          <Button
            aria-label={`${mode === "record" ? "Choose asset" : "Filter by asset"}: ${label}`}
            className="h-auto min-h-11 w-full justify-start whitespace-normal text-left [overflow-wrap:anywhere]"
            variant="outline"
          />
        }
      >
        {label}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "record" ? "Choose asset" : "Filter by asset"}
          </DialogTitle>
          <DialogDescription>
            {mode === "record"
              ? "Choose an active asset to record a manual reading."
              : "Choose an asset in this estate, including retired equipment."}
          </DialogDescription>
        </DialogHeader>
        <Label htmlFor="reading-asset-search">Search assets</Label>
        <Input
          id="reading-asset-search"
          onChange={searchChange}
          placeholder="Name or reference"
          value={search}
        />
        {mode === "filter" ? (
          <Button onClick={clear} variant="outline">
            All assets
          </Button>
        ) : null}
        {assets.isPending ? <p role="status">Loading assets…</p> : null}
        {assets.error ? (
          <p role="alert">
            {assets.error.message}{" "}
            <Button onClick={retry} variant="outline">
              Retry assets
            </Button>
          </p>
        ) : null}
        {assets.data?.totalItems === 0 ? (
          <p role="status">No assets match this search.</p>
        ) : null}
        <div className="grid max-h-64 gap-2 overflow-y-auto">
          {assets.data?.items.map((asset) => (
            <ReadingAssetChoice
              activeOnly={mode === "record"}
              asset={asset}
              key={asset.id}
              onChoose={choose}
            />
          ))}
        </div>
        {assets.data && assets.data.totalItems > assets.data.size ? (
          <nav
            aria-label="Asset options pagination"
            className="flex flex-wrap justify-between gap-2"
          >
            <Button disabled={page === 0} onClick={previous} variant="outline">
              Previous assets
            </Button>
            <Button
              disabled={(page + 1) * assets.data.size >= assets.data.totalItems}
              onClick={next}
              variant="outline"
            >
              Next assets
            </Button>
          </nav>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
