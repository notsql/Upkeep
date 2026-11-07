import type { EstateReportFilters } from "@/lib/estate-reports";

/** The report list's URL search: its filters plus the page cursor. */
export type EstateReportsSearch = EstateReportFilters & { cursor?: string };
