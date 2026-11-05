import { buttonVariants } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";
import { ClipboardCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PageLayout } from "@/components/page-layout";
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
    <PageLayout className="space-y-4">
      <PageHeader icon={ClipboardCheck} title="Inspection saved" />
      {error ? <p role="alert">{error.message}</p> : null}
      <Link
        className={buttonVariants()}
        params={{ estateId, assetId, inspectionId: saved.id }}
        to="/estates/$estateId/assets/$assetId/inspections/$inspectionId"
      >
        View saved inspection
      </Link>
    </PageLayout>
  );
}
