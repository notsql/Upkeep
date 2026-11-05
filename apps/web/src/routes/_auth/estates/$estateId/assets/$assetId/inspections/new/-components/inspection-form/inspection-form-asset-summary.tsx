import { DetailCard } from "@/components/page/detail-card";
import { FormPageHeader } from "@/components/page/form-page-header";
import type { InspectionAsset } from "@/lib/inspections";

export function InspectionFormAssetSummary({
  active,
  assetId,
  estateId,
  observed,
}: {
  active: boolean;
  assetId: string;
  estateId: string;
  observed: InspectionAsset;
}) {
  return (
    <>
      <FormPageHeader
        breadcrumbs={[
          {
            label: observed.name,
            to: "/estates/$estateId/assets/$assetId",
            params: { estateId, assetId },
          },
          { label: "Create inspection record" },
        ]}
        description={`${observed.reference} · ${observed.name}`}
        title="Create inspection record"
      />
      <DetailCard>
        <div>
          <dt>Asset</dt>
          <dd>
            {observed.reference} · {observed.name}
          </dd>
        </div>
        <div>
          <dt>Location</dt>
          <dd>{observed.locationPath}</dd>
        </div>
      </DetailCard>
      {active ? null : (
        <p role="alert">
          This estate, asset or location is inactive or retired. Existing
          records remain available.
        </p>
      )}
    </>
  );
}
