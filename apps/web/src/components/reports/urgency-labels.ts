import type { components } from "@proj/api/schema";

export const urgencyLabels: Record<
  components["schemas"]["EstateIssueReportSummaryResponse"]["urgency"],
  string
> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High", URGENT: "Urgent" };
