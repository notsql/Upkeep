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
  children,
}: {
  report: components["schemas"]["IssueReportSummaryResponse"];
  title?: ReactNode;
  locationAction?: ReactNode;
  showUpdated?: boolean;
  children?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="wrap-anywhere font-semibold">{title}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <ReportMetadata
          locationAction={locationAction}
          report={report}
          showUpdated={showUpdated}
        />
        {children}
      </CardContent>
    </Card>
  );
}
