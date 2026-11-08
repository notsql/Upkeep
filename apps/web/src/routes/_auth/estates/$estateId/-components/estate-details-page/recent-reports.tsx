import { Badge } from "@proj/ui/components/badge";
import { Link } from "@tanstack/react-router";
import { ClipboardList } from "lucide-react";
import { useEstateReportList } from "@/lib/estate-reports";
import {
  footerLink,
  NO_FILTERS,
  RECENT,
} from "@/routes/_auth/estates/$estateId/-components/estate-details-page/dashboard-lists";
import { ListCard } from "@/routes/_auth/estates/$estateId/-components/estate-details-page/list-card";

export function RecentReports({ estateId }: { estateId: string }) {
  const list = useEstateReportList(estateId, NO_FILTERS);
  const items = (list.data?.items ?? []).slice(0, RECENT);
  return (
    <ListCard
      description="Highest urgency first"
      empty={items.length === 0}
      footer={
        <Link
          className={footerLink}
          params={{ estateId }}
          to="/estates/$estateId/reports"
        >
          All fault reports
        </Link>
      }
      icon={ClipboardList}
      title="Fault reports by urgency"
    >
      {items.map((report) => (
        <li className="py-2 first:pt-0" key={report.id}>
          <Link
            className="flex items-start justify-between gap-3"
            params={{ estateId, reportId: report.id }}
            to="/estates/$estateId/reports/$reportId"
          >
            <span className="min-w-0">
              <span className="block font-medium">{report.title}</span>
              <span className="text-muted-foreground block truncate text-sm">
                {report.location.label}
              </span>
            </span>
            <Badge variant="outline">
              {report.status.toLowerCase().replaceAll("_", " ")}
            </Badge>
          </Link>
        </li>
      ))}
    </ListCard>
  );
}
