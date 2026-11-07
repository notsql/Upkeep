import { useId } from "react";
import type { InspectionList } from "@/lib/inspection-list";

export function Unscheduled({ data }: { data: InspectionList }) {
  const headingId = useId();
  if (data.unscheduled.length === 0) {
    return null;
  }
  return (
    <section aria-labelledby={headingId} className="grid gap-2">
      <h2 className="text-lg font-semibold" id={headingId}>
        Not scheduled assets
      </h2>
      <p className="text-muted-foreground text-sm">
        These flagged assets have been inspected or installed, but have no
        service interval, so no due date can be worked out.
      </p>
      <ul className="grid gap-1">
        {data.unscheduled.map((asset) => (
          <li className="flex flex-wrap gap-2" key={asset.assetId}>
            <span>{`${asset.assetReference} · ${asset.assetName}`}</span>
            <span className="text-muted-foreground">{asset.categoryLabel}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
