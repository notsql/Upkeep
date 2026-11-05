import { renderWithProviders, screen, within } from "@tests/test-utils";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { ResidentDashboard } from "@/routes/-components/resident-dashboard";

vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "resident-a" }, loading: false }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    search,
    params: _params,
    ...props
  }: {
    children: ReactNode;
    to: string;
    params?: unknown;
    search?: { estateId?: string };
  }) => (
    <a
      href={search?.estateId ? `${to}?estateId=${search.estateId}` : to}
      {...props}
    >
      {children}
    </a>
  ),
}));
vi.mock("@/lib/api", () => ({ api: { GET: vi.fn() } }));

function report(index: number) {
  return {
    id: `report-${index}`,
    title: `Fault ${index}`,
    description: "Broken",
    estateName: "Maple Estate",
    location: { id: "loc", label: "Block 1" },
    status: "SUBMITTED",
    createdAt: "2026-11-01T00:00:00Z",
    updatedAt: "2026-11-01T00:00:00Z",
  };
}

function respond(
  items: ReturnType<typeof report>[],
  counts = { open: 0, inProgress: 0, resolved: 0 }
) {
  vi.mocked(api.GET).mockResolvedValue({
    data: { items, nextCursor: null, counts },
    response: new Response(),
  } as never);
}

beforeEach(() => vi.mocked(api.GET).mockReset());

it("shows the server's status counts and at most five recent reports", async () => {
  respond([1, 2, 3, 4, 5, 6].map(report), {
    open: 7,
    inProgress: 3,
    resolved: 12,
  });
  renderWithProviders(<ResidentDashboard estateId="maple" />);
  screen.getByRole("heading", { name: "Dashboard", level: 1 });
  const open = await screen.findByRole("region", { name: "Open" });
  within(open).getByText("7");
  within(screen.getByRole("region", { name: "In progress" })).getByText("3");
  within(screen.getByRole("region", { name: "Resolved" })).getByText("12");
  expect(
    screen.getByRole("link", { name: "Fault 5" }).getAttribute("href")
  ).toBe("/reports/$reportId?estateId=maple");
  expect(screen.queryByRole("heading", { name: "Fault 6" })).toBeNull();
  expect(
    screen.getByRole("link", { name: "View all" }).getAttribute("href")
  ).toBe("/reports?estateId=maple");
  expect(
    screen.getByRole("link", { name: "Report a fault" }).getAttribute("href")
  ).toBe("/reports/new?estateId=maple");
  expect(vi.mocked(api.GET).mock.calls[0]).toEqual([
    "/resident/reports",
    { params: { query: { estateId: "maple" } } },
  ]);
});

it("invites a resident with no reports to report their first fault", async () => {
  respond([]);
  renderWithProviders(<ResidentDashboard estateId="maple" />);
  await screen.findByText("You haven't reported any faults yet.");
  expect(
    screen.getAllByRole("link", { name: "Report a fault" }).length
  ).toBeGreaterThan(0);
  expect(screen.queryByRole("link", { name: "View all" })).toBeNull();
});
