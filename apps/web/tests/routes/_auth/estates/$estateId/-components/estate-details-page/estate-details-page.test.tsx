import {
  crewEstateAccess,
  ownerEstateAccess,
  unassignedAccess,
} from "@tests/fixtures/access";
import {
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@tests/test-utils";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppAccess } from "@/lib/access";
import { api } from "@/lib/api";
import { EstateDetailsPage } from "@/routes/_auth/estates/$estateId/-components/estate-details-page/estate-details-page";

vi.mock("@/lib/api", () => ({
  api: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn() },
}));
vi.mock("@/lib/access", async (original) => ({
  ...(await original<typeof import("@/lib/access")>()),
  useAppAccess: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "owner" }, loading: false }),
}));
const WO_1 = /WO-0001/u;
const WO_2 = /WO-0002/u;
const LEAK = /Leaking pipe/u;
const PUMP = /PUMP-01/u;
const DIGIT = /^\d/u;

const estate = {
  id: "estate-id",
  name: "Maple Grove",
  code: "MG-001",
  address: "1 Grove Road",
  postalCode: "123456",
  createdAt: "2026-09-25T00:00:00Z",
  updatedAt: "2026-09-25T00:00:00Z",
  owned: true,
};

const dashboardData: Record<string, unknown> = {
  "/estates/{estateId}/work-orders": {
    items: [
      {
        id: "wo-1",
        reference: "WO-0001",
        description: "Lift door stuck",
        locationPath: "Block A / Level 2",
        priority: "URGENT",
        status: "OPEN",
      },
      {
        id: "wo-2",
        reference: "WO-0002",
        description: "Replace lamp",
        locationPath: "Block B",
        priority: "LOW",
        status: "CLOSED",
      },
    ],
  },
  "/estates/{estateId}/reports": {
    items: [
      {
        id: "r-1",
        title: "Leaking pipe",
        description: "Water on floor",
        estateName: "Maple Grove",
        location: { id: "l", label: "Block A / Level 3" },
        status: "OPEN",
        createdAt: "2026-10-01T00:00:00Z",
        updatedAt: "2026-10-01T00:00:00Z",
      },
    ],
    nextCursor: null,
  },
  "/estates/{estateId}/inspection-list": {
    overdueCount: 3,
    dueCount: 5,
    doneCount: 1,
    checks: [],
    unscheduled: [],
  },
  "/estates/{estateId}/devices": [
    { id: "d-1", status: "ONLINE" },
    { id: "d-2", status: "OFFLINE" },
    { id: "d-3", status: "OFFLINE" },
  ],
  "/estates/{estateId}/costs/top-assets": [
    {
      assetId: "a-9",
      assetReference: "LIFT-07",
      assetName: "Passenger lift",
      category: "LIFT",
      categoryLabel: "Lift",
      totalSpend: "12480.00",
      entriesWithUnknownCosts: 0,
    },
  ],
  "/estates/{estateId}/costs/forecast": {
    from: "2026-11-08",
    to: "2027-11-08",
    total: "18300.00",
    scheduledServices: { total: "12000.00", services: 14 },
    predictedRepairs: { total: "6300.00", expectedRepairs: 1.6 },
    assetsWithoutCostBasis: 0,
  },
  "/estates/{estateId}/failure-risk": [
    {
      assetId: "a-1",
      assetReference: "PUMP-01",
      assetName: "Booster pump",
      flagged: true,
      flagReasons: ["FAILURE_RISK"],
    },
    {
      assetId: "a-2",
      assetReference: "FAN-01",
      assetName: "Fan",
      flagged: false,
      flagReasons: [],
    },
  ],
};

function mockDashboard(estateData: unknown) {
  vi.mocked(api.GET).mockImplementation(((path: string) =>
    Promise.resolve({
      data: path === "/estates/{id}" ? estateData : dashboardData[path],
      response: new Response(),
    })) as never);
}

describe("estate overview dashboard", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useAppAccess).mockReturnValue({
      data: {
        ...unassignedAccess,
        estates: [{ ...ownerEstateAccess, estateId: estate.id }],
      },
    } as unknown as ReturnType<typeof useAppAccess>);
  });

  it("announces loading the estate with the shared loading state", async () => {
    mockDashboard(estate);
    renderWithProviders(<EstateDetailsPage estateId={estate.id} />);
    screen.getByRole("status", { name: "Loading estate…" });
    await screen.findByRole("heading", { name: estate.name });
  });

  it("summarises open work, reports, inspections, devices and risk", async () => {
    mockDashboard(estate);
    renderWithProviders(<EstateDetailsPage estateId={estate.id} />);
    await screen.findByRole("heading", { name: estate.name });
    const count = async (name: string) =>
      within(await screen.findByRole("region", { name })).getByText(
        (_, element) =>
          element?.tagName === "P" && DIGIT.test(element.textContent ?? "")
      ).textContent;
    await waitFor(async () =>
      expect(await count("Open work orders")).toBe("1")
    );
    await waitFor(async () =>
      expect(await count("Overdue inspections")).toBe("3")
    );
    await waitFor(async () => expect(await count("Offline devices")).toBe("2"));
    await waitFor(async () => expect(await count("Flagged assets")).toBe("1"));
    await screen.findByRole("link", { name: WO_1 });
    expect(screen.queryByRole("link", { name: WO_2 })).toBeNull();
    await screen.findByRole("link", { name: LEAK });
    await screen.findByRole("link", { name: PUMP });
    expect(screen.queryByRole("link", { name: "Estate settings" })).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    await within(
      await screen.findByRole("region", { name: "Maintenance budget" })
    ).findByText("S$18,300.00");
    await within(
      await screen.findByRole("region", { name: "Costliest assets" })
    ).findByText("S$12,480.00");
  });

  it("only loads the sections a member may see", async () => {
    mockDashboard({ ...estate, owned: false });
    vi.mocked(useAppAccess).mockReturnValue({
      data: {
        ...unassignedAccess,
        estates: [{ ...crewEstateAccess, estateId: estate.id }],
      },
    } as unknown as ReturnType<typeof useAppAccess>);
    renderWithProviders(<EstateDetailsPage estateId={estate.id} />);
    await screen.findByRole("heading", { name: estate.name });
    const paths = vi.mocked(api.GET).mock.calls.map((call) => call[0]);
    for (const path of [
      "/estates/{estateId}/inspection-list",
      "/estates/{estateId}/devices",
      "/estates/{estateId}/failure-risk",
      "/estates/{estateId}/costs/top-assets",
      "/estates/{estateId}/costs/forecast",
    ]) {
      expect(paths).not.toContain(path);
    }
    expect(
      screen.queryByRole("region", { name: "Maintenance budget" })
    ).toBeNull();
    expect(
      screen.queryByRole("region", { name: "Costliest assets" })
    ).toBeNull();
    expect(screen.queryByRole("region", { name: "Flagged assets" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Estate settings" })).toBeNull();
  });
});

describe("estate details page", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useAppAccess).mockReturnValue({
      data: unassignedAccess,
    } as unknown as ReturnType<typeof useAppAccess>);
  });

  it("shows name, status, description and details without the action row or Assets card", async () => {
    mockDashboard({
      ...estate,
      description: "Riverside condo",
      canInviteMembers: true,
      canManageInvitationPermissions: true,
    });
    vi.mocked(useAppAccess).mockReturnValue({
      data: {
        ...unassignedAccess,
        estates: [{ ...ownerEstateAccess, estateId: estate.id }],
      },
    } as unknown as ReturnType<typeof useAppAccess>);
    renderWithProviders(<EstateDetailsPage estateId={estate.id} />);
    await screen.findByRole("heading", { name: estate.name });
    expect(
      screen
        .getAllByRole("status")
        .some((status) => status.textContent === "Active")
    ).toBe(true);
    expect(screen.getAllByText("Riverside condo").length).toBeGreaterThan(0);
    screen.getByText("MCST MG-001");
    screen.getByText("1 Grove Road");
    expect(screen.queryByRole("group", { name: "Estate actions" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Estate assets" })).toBeNull();
    for (const name of [
      "View assets",
      "Register asset",
      "Back to estates",
      "Edit estate",
      "Estates",
    ]) {
      expect(screen.queryByRole("link", { name })).toBeNull();
    }
    expect(
      screen.queryByRole("button", { name: "Deactivate estate" })
    ).toBeNull();
    expect(
      screen.queryByRole("navigation", { name: "Breadcrumbs" })
    ).toBeNull();
  });

  it("does not fetch administrative data for Crew", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      data: { ...estate, owned: false },
      response: new Response(),
    });
    vi.mocked(useAppAccess).mockReturnValue({
      data: {
        ...unassignedAccess,
        estates: [{ ...crewEstateAccess, estateId: estate.id }],
      },
    } as unknown as ReturnType<typeof useAppAccess>);
    renderWithProviders(<EstateDetailsPage estateId={estate.id} />);
    await screen.findByRole("heading", { name: estate.name });
    expect(
      vi
        .mocked(api.GET)
        .mock.calls.some((call) =>
          ["/estates/{estateId}/members", "/estates/{estateId}/roles"].includes(
            call[0]
          )
        )
    ).toBe(false);
  });

  it("keeps inactive details visible", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      data: { ...estate, deactivatedAt: "2026-09-25T00:00:00Z" },
      response: new Response(),
    });
    renderWithProviders(<EstateDetailsPage estateId="estate-id" />);
    await screen.findByRole("heading", { name: "Maple Grove" });
    expect(screen.getByRole("status").textContent).toContain("Inactive");
    screen.getByRole("note");
  });

  it("notes a granted estate is shared read-only", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      data: { ...estate, owned: false },
      response: new Response(),
    });
    renderWithProviders(<EstateDetailsPage estateId="estate-id" />);
    await screen.findByRole("heading", { name: "Maple Grove" });
    screen.getByText(
      "Shared with you. Only the owner or an assigned Manager can edit estate details."
    );
  });
});
