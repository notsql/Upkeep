import { Button } from "@proj/ui/components/button";
import { useCallback } from "react";
import type { ReadingAsset } from "@/lib/readings";

export function ReadingAssetChoice({
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
      className="h-auto min-h-11 justify-start text-left [overflow-wrap:anywhere] whitespace-normal"
      disabled={activeOnly && asset.retired}
      onClick={choose}
      variant="outline"
    >
      {asset.reference} · {asset.name}
      {asset.retired ? " · Retired" : ""}
    </Button>
  );
}
