import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReportUrgencyBadges } from "@/components/reports/report-urgency-badges";

describe("ReportUrgencyBadges", () => {
  it.each([
    ["LOW", "Low", "outline"],
    ["MEDIUM", "Medium", "info"],
    ["HIGH", "High", "warning"],
    ["URGENT", "Urgent", "destructive"],
  ] as const)(
    "labels %s as %s in the %s variant",
    (urgency, label, variant) => {
      render(<ReportUrgencyBadges isSafety={false} urgency={urgency} />);
      expect(screen.getByText(label).dataset.variant).toBe(variant);
    }
  );

  it("flags a safety report in the destructive variant", () => {
    render(<ReportUrgencyBadges isSafety urgency="URGENT" />);
    expect(screen.getByText("Safety").dataset.variant).toBe("destructive");
  });
});
