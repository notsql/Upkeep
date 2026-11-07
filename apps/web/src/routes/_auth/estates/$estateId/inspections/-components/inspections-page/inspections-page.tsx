import { ClipboardCheck } from "lucide-react";
import { ListPageHeader } from "@/components/page/list-page-header";
import { PageLayout } from "@/components/page/page-layout";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { GenerateButton } from "@/routes/_auth/estates/$estateId/inspections/-components/inspections-page/generate-button";
import { InspectionsChecks } from "@/routes/_auth/estates/$estateId/inspections/-components/inspections-page/inspections-checks";
import { InspectionsGenerationStatus } from "@/routes/_auth/estates/$estateId/inspections/-components/inspections-page/inspections-generation-status";
import { InspectionsNoFlaggedCategories } from "@/routes/_auth/estates/$estateId/inspections/-components/inspections-page/inspections-no-flagged-categories";
import { SummaryCards } from "@/routes/_auth/estates/$estateId/inspections/-components/inspections-page/summary-cards";
import { Unscheduled } from "@/routes/_auth/estates/$estateId/inspections/-components/inspections-page/unscheduled";
import { useInspectionsPage } from "@/routes/_auth/estates/$estateId/inspections/-components/inspections-page/use-inspections-page";

function monthLabel(month: string): string {
  return new Date(`${month}T00:00:00`).toLocaleDateString("en-SG", {
    month: "long",
    year: "numeric",
  });
}

/** The estate's monthly inspection list with overdue checks (ID-84, ID-86). */
export function InspectionsPage({ estateId }: { estateId: string }) {
  const { access, data, error, generate, list, retry, run } =
    useInspectionsPage(estateId);

  return (
    <PageLayout>
      <ListPageHeader
        actions={
          data ? (
            <GenerateButton
              data={data}
              onGenerate={run}
              pending={generate.isPending}
            />
          ) : null
        }
        description={data ? monthLabel(data.month) : undefined}
        icon={ClipboardCheck}
        title="Inspections"
      />
      {list.isPending ? <LoadingState label="Loading inspections…" /> : null}
      {list.error ? (
        <ErrorState message={list.error.message} onRetry={retry} />
      ) : null}
      {data ? (
        <div className="grid gap-6">
          <SummaryCards data={data} estateId={estateId} />
          <InspectionsGenerationStatus data={data} error={error} />
          {data.flaggedCategoryCount === 0 ? (
            <InspectionsNoFlaggedCategories estateId={estateId} />
          ) : null}
          <InspectionsChecks
            canRecord={access.canCreate}
            checks={data.checks}
            estateId={estateId}
            generated={!!data.generatedAt}
          />
          <Unscheduled data={data} />
        </div>
      ) : null}
    </PageLayout>
  );
}
