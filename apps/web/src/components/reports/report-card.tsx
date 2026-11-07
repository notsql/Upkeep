import type { components } from "@proj/api/schema";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@proj/ui/components/card";
import type { ReactNode } from "react";
import { ReportMetadata } from "@/components/reports/report-metadata";

export function ReportCard({
  report,
  title = report.title,
  locationAction,
  showUpdated = false,
  badges,
  urgency,
  children,
}: {
  report: components["schemas"]["IssueReportSummaryResponse"];
  title?: ReactNode;
  locationAction?: ReactNode;
  showUpdated?: boolean;
  badges?: ReactNode;
  urgency?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="font-semibold wrap-anywhere">{title}</h2>
        </CardTitle>
        {badges}
      </CardHeader>
      <CardContent className="grid gap-4">
        <ReportMetadata
          locationAction={locationAction}
          report={report}
          showUpdated={showUpdated}
          urgency={urgency}
        />
        {children}
      </CardContent>
    </Card>
  );
}
