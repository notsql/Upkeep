import type { ReactNode } from "react";
import { SectionCard } from "@/components/page/section-card";
import { ReportUrgencyBadges } from "@/components/reports/report-urgency-badges";
import type { EstateReport } from "@/lib/estate-reports";
import { categoryLabel, type ReportRouting } from "@/lib/report-routing";
import { ChangeCategoryDialog } from "./change-category-dialog";
import { ChangeLocationDialog } from "./change-location-dialog/change-location-dialog";
import { ChangeUrgencyDialog } from "./change-urgency-dialog/change-urgency-dialog";
import { LatestUrgencyChange } from "./latest-urgency-change";

function Row({
  label,
  action,
  children,
}: {
  label: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1 sm:grid-cols-[7rem_1fr] sm:gap-x-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 flex-wrap items-start justify-between gap-2">
        <div className="grid min-w-0 gap-1 wrap-anywhere">{children}</div>
        {action}
      </dd>
    </div>
  );
}

function formatted(value: string): ReactNode {
  return <time dateTime={value}>{new Date(value).toLocaleString()}</time>;
}

function howSorted(
  classification: NonNullable<ReportRouting["classification"]>
): string {
  if (classification.manual) {
    return `Changed by ${classification.classifiedByName ?? "a manager"}, ${new Date(classification.createdAt).toLocaleString()}`;
  }
  return `Sorted automatically, ${Math.round(classification.confidence * 100)}% sure`;
}

/** Every editable field of the report, each with its own change button. */
export function DetailsCard({
  estateId,
  report,
  reload,
  canRelocate,
  canChangeUrgency,
  canChangeType,
}: {
  estateId: string;
  report: EstateReport;
  reload: () => Promise<EstateReport | undefined>;
  canRelocate: boolean;
  canChangeUrgency: boolean;
  canChangeType: boolean;
}) {
  const classification = report.routing?.classification ?? null;
  const category = classification?.category ?? null;
  return (
    <SectionCard title="Details">
      <dl className="grid gap-3">
        <Row label="Estate">{report.estateName}</Row>
        <Row
          action={
            canRelocate ? (
              <ChangeLocationDialog
                estateId={estateId}
                reload={reload}
                report={report}
              />
            ) : null
          }
          label="Location"
        >
          {report.location?.label}
        </Row>
        <Row
          action={
            canChangeUrgency ? (
              <ChangeUrgencyDialog
                estateId={estateId}
                reload={reload}
                report={report}
              />
            ) : null
          }
          label="Urgency"
        >
          <ReportUrgencyBadges
            isSafety={report.isSafety}
            urgency={report.urgency}
          />
          <LatestUrgencyChange change={report.lastUrgencyChange} />
        </Row>
        <Row
          action={
            canChangeType ? (
              <ChangeCategoryDialog
                current={category}
                estateId={estateId}
                reportId={report.id}
              />
            ) : null
          }
          label="Type"
        >
          {classification && category ? (
            <>
              <span>{categoryLabel(category)}</span>
              <span className="text-muted-foreground text-sm">
                {howSorted(classification)}
              </span>
            </>
          ) : (
            <span>Not sorted into a type yet</span>
          )}
        </Row>
        <Row label="Submitted">
          {report.createdAt ? formatted(report.createdAt) : null}
        </Row>
        <Row label="Updated">{formatted(report.updatedAt)}</Row>
      </dl>
    </SectionCard>
  );
}
