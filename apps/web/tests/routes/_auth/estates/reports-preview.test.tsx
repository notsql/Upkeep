import { renderWithProviders, screen } from "@tests/test-utils";
import { expect, it, vi } from "vitest";
import { RecentReports } from "@/routes/_auth/estates/$estateId/-components/estate-details-page/recent-reports";

vi.mock("@/lib/estate-reports", () => ({
  useEstateReportList: () => ({ data: { items: [] } }),
}));
vi.mock("@tanstack/react-router", () => ({ Link: () => null }));

it("labels the estate report preview with its urgency ordering", () => {
  renderWithProviders(<RecentReports estateId="estate" />);
  screen.getByRole("heading", { name: "Fault reports by urgency" });
  expect(screen.getByText("Highest urgency first")).toBeTruthy();
});
