import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { buttonVariants } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";
import { FormCard, FormPage } from "@/components/page/form-page";
import type { InspectionResult } from "@/lib/inspections";

export function SavedInspectionNotice({
  saved,
  error,
  estateId,
  assetId,
}: {
  saved: InspectionResult;
  error?: Error;
  estateId: string;
  assetId: string;
}) {
  return (
    <FormPage
      breadcrumbs={[
        {
          label: "Asset",
          to: "/estates/$estateId/assets/$assetId",
          params: { estateId, assetId },
        },
        { label: "Inspection saved" },
      ]}
      title="Inspection saved"
    >
      <FormCard>
        <div className="grid gap-4">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          ) : null}
          <div>
            <Link
              className={buttonVariants()}
              params={{ estateId, assetId, inspectionId: saved.id }}
              to="/estates/$estateId/assets/$assetId/inspections/$inspectionId"
            >
              View saved inspection
            </Link>
          </div>
        </div>
      </FormCard>
    </FormPage>
  );
}
