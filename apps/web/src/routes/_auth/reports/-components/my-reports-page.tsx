import { useAuthenticatedSession } from "@/lib/access";
import {
  type HistoryProps,
  ReportHistory,
} from "@/routes/_auth/reports/-components/report-history";

export function MyReportsPage(props: HistoryProps) {
  const { userId } = useAuthenticatedSession();
  return (
    <ReportHistory key={`${userId}:${props.estateId ?? "all"}`} {...props} />
  );
}
