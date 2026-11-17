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

  it("leaves the Urgency label to the column or row that holds the badges", () => {
    render(<ReportUrgencyBadges isSafety={false} urgency="MEDIUM" />);
    screen.getByText("Medium");
    expect(screen.queryByText("Urgency:")).toBeNull();
  });

  it("names the badges Urgency where nothing else does, as on a phone", () => {
    render(<ReportUrgencyBadges isSafety={false} labelled urgency="MEDIUM" />);
    screen.getByText("Urgency:");
  });

  it("flags a safety report in the destructive variant", () => {
    render(<ReportUrgencyBadges isSafety urgency="URGENT" />);
    expect(screen.getByText("Safety").dataset.variant).toBe("destructive");
  });
});
