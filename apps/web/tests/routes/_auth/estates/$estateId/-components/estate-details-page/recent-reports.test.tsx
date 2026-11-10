import { renderWithProviders, screen } from "@tests/test-utils";
import type { ReactNode } from "react";
import { it, vi } from "vitest";
import { RecentReports } from "@/routes/_auth/estates/$estateId/-components/estate-details-page/recent-reports";

vi.mock("@/lib/estate-reports", () => ({
  useEstateReportList: () => ({
    data: {
      items: [
        {
          id: "r1",
          title: "Lift stuck",
          status: "IN_PROGRESS",
          location: { label: "Block A" },
        },
      ],
    },
  }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
}));

it("labels each report's status in words", () => {
  renderWithProviders(<RecentReports estateId="estate" />);
  screen.getByText("In progress");
});
