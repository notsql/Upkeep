import type { components } from "@proj/api/schema";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReportMetadata } from "@/components/reports/report-metadata";

const report = {
  id: "r1",
  title: "Leak",
  estateName: "Estate",
  status: "IN_PROGRESS",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
} as unknown as components["schemas"]["IssueReportSummaryResponse"];

describe("ReportMetadata", () => {
  it("shows the status as a toned label, not the raw enum", () => {
    render(<ReportMetadata report={report} />);
    expect(screen.getByText("In progress").dataset.variant).toBe("warning");
    expect(screen.queryByText("IN_PROGRESS")).toBeNull();
  });
});
