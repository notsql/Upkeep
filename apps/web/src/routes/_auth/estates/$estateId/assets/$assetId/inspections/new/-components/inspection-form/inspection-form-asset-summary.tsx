import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { FormCard } from "@/components/page/form-page";
import type { InspectionAsset } from "@/lib/inspections";

export function InspectionFormAssetSummary({
  active,
  observed,
}: {
  active: boolean;
  observed: InspectionAsset;
}) {
  return (
    <FormCard title="Asset">
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <div className="grid gap-1">
          <dt className="text-muted-foreground">Asset</dt>
          <dd>
            {observed.reference} · {observed.name}
          </dd>
        </div>
        <div className="grid gap-1">
          <dt className="text-muted-foreground">Location</dt>
          <dd>{observed.locationPath}</dd>
        </div>
      </dl>
      {active ? null : (
        <Alert className="mt-4" variant="destructive">
          <AlertDescription>
            This estate, asset or location is inactive or retired. Existing
            records remain available.
          </AlertDescription>
        </Alert>
      )}
    </FormCard>
  );
}
